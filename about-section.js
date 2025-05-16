import { aboutManager, makeEditable } from './about.js';

// Function to create and insert an about section
export function insertAboutSection(containerId, sections = ['bio']) {
    // Wait for DOM content to be loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializeAboutSection());
    } else {
        initializeAboutSection();
    }

    function initializeAboutSection() {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container with ID '${containerId}' not found`);
            return;
        }

        // Check if container already has an about section
        const existingSection = container.querySelector('.about-section');
        if (existingSection) {
            console.warn('About section already exists in container');
            return;
        }

        // Create the about section
        const aboutSection = document.createElement('div');
        aboutSection.className = 'about-section';

        // Create a map to store section elements
        const sectionElements = new Map();

        // Add content placeholders for requested sections
        sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.id = `about${section.charAt(0).toUpperCase() + section.slice(1)}`;
            sectionDiv.className = 'about-text';
            sectionDiv.innerHTML = 'Loading...';
            aboutSection.appendChild(sectionDiv);
            sectionElements.set(section, sectionDiv);

            // Make the section editable with the correct section ID
            makeEditable(sectionDiv, 
                (newContent) => aboutManager.updateContent(newContent),
                section
            );
        });

        // Insert the section into the container
        container.appendChild(aboutSection);

        // Create a single observer that updates all sections
        const contentObserver = (content) => {
            if (!content) return;
            
            sectionElements.forEach((element, section) => {
                if (content[section] !== undefined) {
                    element.innerHTML = content[section];
                }
            });
        };

        // Add the observer and store it on the container
        aboutManager.addObserver(contentObserver);
        
        // Store the observer reference on the container for cleanup
        container.dataset.aboutObserver = true;
    }
}

// Add necessary styles
const styles = `
.about-section {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    padding: 30px;
    margin-bottom: 30px;
    opacity: 1;
    transform: translateY(0);
    position: relative;
}

.about-text {
    color: #444;
    line-height: 1.6;
    margin-bottom: 15px;
}

.edit-button {
    position: absolute;
    top: 5px;
    right: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 5px;
    color: #666;
    transition: color 0.3s ease;
}

.edit-button:hover {
    color: #333;
}

.editing {
    outline: 2px solid #ff69b4;
    padding: 5px;
    border-radius: 4px;
}
`;

// Add styles to document only when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addStyles);
} else {
    addStyles();
}

function addStyles() {
    // Check if styles are already added
    if (!document.querySelector('style[data-about-styles]')) {
        const styleSheet = document.createElement('style');
        styleSheet.dataset.aboutStyles = true;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
} 