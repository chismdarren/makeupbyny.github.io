// Simple script to handle form submissions (for now, it logs the data)
document.getElementById('postForm').addEventListener('submit', function(event) {
    event.preventDefault();
    let title = document.getElementById('title').value;
    let content = document.getElementById('content').value;
    console.log('Title:', title);
    console.log('Content:', content);
});
