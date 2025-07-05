// Debug utility for virtual pet API issues
export function debugVirtualPetAuth() {
  console.log("=== Virtual Pet Authentication Debug ===");

  // Check if we're in browser environment
  if (typeof window === "undefined") {
    console.log("❌ Not in browser environment");
    return;
  }

  // Check cookies
  console.log("🍪 Checking cookies...");
  console.log("document.cookie:", document.cookie);

  // Extract moodleToken from cookies
  const cookies = document.cookie.split(";").reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split("=");
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);

  console.log("🍪 Parsed cookies:", cookies);

  if (cookies.moodleToken) {
    console.log(
      "✅ moodleToken found:",
      cookies.moodleToken.substring(0, 20) + "..."
    );
  } else {
    console.log("❌ moodleToken NOT found in cookies");
  }

  if (cookies.moodleUser) {
    try {
      const userData = JSON.parse(decodeURIComponent(cookies.moodleUser));
      console.log("✅ moodleUser found:", userData);
    } catch (e) {
      console.log(
        "❌ moodleUser found but failed to parse:",
        cookies.moodleUser
      );
    }
  } else {
    console.log("❌ moodleUser NOT found in cookies");
  }

  // Check localStorage
  console.log("💾 Checking localStorage...");
  try {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    console.log(
      "💾 localStorage token:",
      token ? token.substring(0, 20) + "..." : "null"
    );
    console.log("💾 localStorage user:", user ? JSON.parse(user) : "null");
  } catch (e) {
    console.log("❌ Error accessing localStorage:", e);
  }

  console.log("=== End Debug Info ===");
}
