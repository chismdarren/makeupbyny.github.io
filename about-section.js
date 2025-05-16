import { aboutManager } from './about.js';

// Function to create and insert an about section
export function insertAboutSection(containerId, sections = ['bio']) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create the about section
    const aboutSection = document.createElement('div');
    aboutSection.className = 'about-section';

    // Add content placeholders for requested sections
    sections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.id = `about${section.charAt(0).toUpperCase() + section.slice(1)}`;
        sectionDiv.className = 'about-text';
        sectionDiv.innerHTML = 'Loading...';
        aboutSection.appendChild(sectionDiv);
    });

    // Insert the section into the container
    container.appendChild(aboutSection);

    // Subscribe to content updates
    aboutManager.addObserver((content) => {
        if (!content) return;
        
        sections.forEach(section => {
            const element = document.getElementById(`about${section.charAt(0).toUpperCase() + section.slice(1)}`);
            if (element && content[section]) {
                element.innerHTML = content[section];
            }
        });
    });
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
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet); 