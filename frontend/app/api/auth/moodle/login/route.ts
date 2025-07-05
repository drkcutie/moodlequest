import { type NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";
const MOODLE_URL = process.env.MOODLE_URL || "https://localhost";

// Disable SSL verification for development environments
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, service = "modquest" } = body;

    console.log("Sign-in attempt for user:", username);

    // STEP 1: Get Moodle token via direct call
    try {
      // Construct the token URL
      const tokenUrl = `${MOODLE_URL}/login/token.php?username=${encodeURIComponent(
        username
      )}&password=${encodeURIComponent(password)}&service=${service}`;
      console.log("Fetching token from:", tokenUrl);

      const tokenResponse = await fetch(tokenUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!tokenResponse.ok) {
        console.error(
          "Token fetch failed:",
          tokenResponse.status,
          tokenResponse.statusText
        );
        return NextResponse.json(
          {
            success: false,
            error: `Failed to get Moodle token: ${tokenResponse.statusText}`,
          },
          { status: 401 }
        );
      }

      const tokenData = await tokenResponse.json();

      if (!tokenData.token) {
        console.error("No token in response:", tokenData);
        return NextResponse.json(
          {
            success: false,
            error: tokenData.error || "Failed to authenticate with Moodle",
          },
          { status: 401 }
        );
      }

      const token = tokenData.token;
      console.log("Successfully obtained Moodle token");

      // STEP 2: Get user data using the token
      try {
        // Construct user info URL
        const userInfoUrl = `${MOODLE_URL}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_user_get_users_by_field&moodlewsrestformat=json&field=username&values[0]=${encodeURIComponent(
          username
        )}`;
        console.log("Fetching user info from:", userInfoUrl);

        const userInfoResponse = await fetch(userInfoUrl);

        if (!userInfoResponse.ok) {
          console.error(
            "User info fetch failed:",
            userInfoResponse.status,
            userInfoResponse.statusText
          );
          return NextResponse.json(
            {
              success: false,
              error: `Failed to get user information: ${userInfoResponse.statusText}`,
            },
            { status: 400 }
          );
        }

        const userData = await userInfoResponse.json();

        if (!Array.isArray(userData) || userData.length === 0) {
          console.error("No user data returned:", userData);
          return NextResponse.json(
            {
              success: false,
              error: "No user information found",
            },
            { status: 404 }
          );
        }

        console.log("Successfully retrieved user information");
        const moodleUser = userData[0];
        // console.log("Moodle user data:", moodleUser);

        // Step 1: Get user's enrolled courses
        let detectedRole = "student";
        let checkedCourseId = null;
        try {
          const userCoursesUrl = `${MOODLE_URL}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_enrol_get_users_courses&moodlewsrestformat=json&userid=${moodleUser.id}`;
          const userCoursesResponse = await fetch(userCoursesUrl);
          if (userCoursesResponse.ok) {
            const userCourses = await userCoursesResponse.json();
            if (Array.isArray(userCourses) && userCourses.length > 0) {
              // Check the first course only (as per instructions)
              checkedCourseId = userCourses[0].id;
              // Step 2: Get enrolled users for the first course
              const enrolledUsersUrl = `${MOODLE_URL}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_enrol_get_enrolled_users&moodlewsrestformat=json&courseid=${checkedCourseId}`;
              const enrolledUsersResponse = await fetch(enrolledUsersUrl);
              if (enrolledUsersResponse.ok) {
                const enrolledUsers = await enrolledUsersResponse.json();
                // Find the current user in the enrolled users list
                const currentUser = enrolledUsers.find(
                  (u: any) => u.id === moodleUser.id
                );
                if (currentUser && Array.isArray(currentUser.roles)) {
                  // Prioritize teacher role
                  if (
                    currentUser.roles.some((role: any) => role.roleid === 3)
                  ) {
                    detectedRole = "teacher";
                  } else if (
                    currentUser.roles.some((role: any) => role.roleid === 5)
                  ) {
                    detectedRole = "student";
                  }
                }
              } else {
                console.warn(
                  "Failed to fetch enrolled users for course",
                  checkedCourseId
                );
              }
            }
          } else {
            console.warn("Failed to fetch user courses for role detection");
          }
        } catch (roleDetectError) {
          console.error(
            "Error detecting user role from courses:",
            roleDetectError
          );
        }

        // Construct user object with all necessary data
        const finalUserData = {
          id: moodleUser.id,
          username: moodleUser.username,
          name:
            `${moodleUser.firstname || ""} ${
              moodleUser.lastname || ""
            }`.trim() || moodleUser.username,
          email: moodleUser.email || `${moodleUser.username}@example.com`,
          role: detectedRole,
          moodleId: moodleUser.id,
          token: token,
          privateToken: tokenData.privatetoken || "",
          avatarUrl: moodleUser.profileimageurl || "",
        };

        // Store the user data in our backend (with role)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          const storeUserResponse = await fetch(
            `${API_BASE_URL}/auth/moodle/store-user`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                moodleId: moodleUser.id,
                username: moodleUser.username,
                email: moodleUser.email || `${moodleUser.username}@example.com`,
                firstName: moodleUser.firstname || "",
                lastName: moodleUser.lastname || "",
                token: token,
                privateToken: tokenData.privatetoken || "",
                role: detectedRole, // include the detected role
                profileImageUrl: moodleUser.profileimageurl || "", // include profile image
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!storeUserResponse.ok) {
            console.error(`Error storing user: ${storeUserResponse.status}`);
            // Continue anyway - we still have token and user info for this session
          } else {
            console.log("Successfully stored user data in backend");
          }
        } catch (storageError) {
          console.error(
            "Error connecting to backend for user storage:",
            storageError
          );
          // Continue with login process even if backend storage fails
        }

        if (detectedRole === "student") {
          try {
            await fetch(`${API_BASE_URL}/activity-log/login`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                user_id: finalUserData.moodleId,
                action_type: "login",
                action_details: { method: "moodle" },
                ip_address: request.headers.get("x-forwarded-for") || null,
                user_agent: request.headers.get("user-agent") || null,
              }),
            });
          } catch (logError) {
            console.error("Failed to log login activity:", logError);
          }
        }

        // --- SYNC ENROLLMENTS TO BACKEND ---
        try {
          const syncEnrollmentsResponse = await fetch(
            `${API_BASE_URL}/enrollment/sync-for-user/${moodleUser.id}?token=${token}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );
          if (!syncEnrollmentsResponse.ok) {
            console.error("Failed to sync enrollments for user", moodleUser.id);
          } else {
            console.log("Enrollments synced for user", moodleUser.id);
          }
        } catch (enrollSyncError) {
          console.error("Error syncing enrollments:", enrollSyncError);
        }
        // --- END SYNC ENROLLMENTS ---

        console.log("Login successful for user:", username);
        console.log("User data:", finalUserData);

        // Create the response object
        const response = NextResponse.json({
          success: true,
          token: token,
          privateToken: tokenData.privatetoken || "",
          user: finalUserData,
        });

        response.cookies.set("moodleUser", JSON.stringify(finalUserData), {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
          sameSite: "lax", // Allow cross-site requests in development
          secure: false, // Allow non-HTTPS in development
        });
        response.cookies.set("moodleToken", token, {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
          sameSite: "lax", // Allow cross-site requests in development
          secure: false, // Allow non-HTTPS in development
        });

        return response;
      } catch (userInfoError) {
        console.error("Error fetching user info:", userInfoError);
        return NextResponse.json(
          {
            success: false,
            error:
              userInfoError instanceof Error
                ? userInfoError.message
                : "Failed to retrieve user information",
          },
          { status: 500 }
        );
      }
    } catch (tokenError) {
      console.error("Token fetch error:", tokenError);
      return NextResponse.json(
        {
          success: false,
          error:
            tokenError instanceof Error
              ? tokenError.message
              : "Failed to authenticate with Moodle",
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Authentication failed. Please check your credentials or try again later.",
      },
      { status: 500 }
    );
  }
}
