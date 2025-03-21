// 1. On DOM load, fetch and display the post (if postId is found in the URL).
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("postId");

  if (!postId) {
    document.body.innerHTML = "<h2>Error: No post ID found.</h2>";
    return;
  }

  try {
    // Fetch the post from Firestore.
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      document.body.innerHTML = "<h2>Error: Post not found.</h2>";
      return;
    }

    const postData = postSnap.data();

    // Populate the DOM with the post's details.
    document.getElementById("postTitle").innerText = postData.title;
    document.getElementById("postHeading").innerText = postData.title;
    document.getElementById("postContent").innerText = postData.content;

    // If there's an image, display it.
    if (postData.imageUrl) {
      const imgElement = document.getElementById("postImage");
      imgElement.src = postData.imageUrl;
      imgElement.style.display = "block";
    }

    // Once the post is loaded, also fetch & display any existing comments.
    await fetchAndDisplayComments(postId);

  } catch (error) {
    console.error("Error fetching post:", error);
    document.body.innerHTML = "<h2>Error loading post.</h2>";
  }

  // ... rest of the existing code ...
}); 