// Virtual Pet API service functions
import { apiClient } from "./api-client";

export interface VirtualPetData {
  pet_id: number;
  name: string;
  species: string;
  happiness: number;
  energy: number;
  last_fed: string;
  last_played: string;
  created_at: string;
  last_updated: string;
  accessories: any[];
}

export interface VirtualPetResponse {
  success: boolean;
  message?: string;
  pet?: VirtualPetData;
  has_pet?: boolean;
  is_new_pet?: boolean;
}

// Get current user's pet
export async function getMyPet(): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>("/virtual-pet/get-pet", "GET");

    return {
      success: true,
      has_pet: true,
      pet: data.pet,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching pet:", error);

    // Handle 404 as a normal case for users without pets
    if (error instanceof Error && error.message.includes("404")) {
      console.log(
        "No pet found for user (404) - this is normal for first-time users"
      );
      return {
        success: true,
        has_pet: false,
        message: "No pet found - first time user",
      };
    }

    // Handle 401 as authentication issue
    if (error instanceof Error && error.message.includes("401")) {
      console.log("Not authenticated (401) - user may need to log in");
      return {
        success: false,
        has_pet: false,
        message: "Authentication required - please log in",
      };
    }

    return {
      success: false,
      has_pet: false,
      message: `Failed to fetch pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Create new pet
export async function createPet(
  name: string,
  species: string = "cat"
): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>("/virtual-pet/create-pet", "POST", {
      name: name,
      species: species,
    });

    return {
      success: true,
      pet: data.pet,
      message: data.message,
      is_new_pet: data.is_new_pet,
    };
  } catch (error) {
    console.error("Error creating pet:", error);

    if (error instanceof Error && error.message.includes("401")) {
      return {
        success: false,
        message: "Authentication required - please log in to create a pet",
      };
    }

    if (error instanceof Error && error.message.includes("400")) {
      return {
        success: false,
        message: "You already have a pet. You can only have one pet at a time.",
      };
    }

    return {
      success: false,
      message: `Failed to create pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Update pet name
export async function updatePetName(name: string): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/update-name",
      "PUT",
      {
        name: name,
      }
    );

    return {
      success: true,
      pet: data.pet,
      message: data.message,
      is_new_pet: false,
    };
  } catch (error) {
    console.error("Error updating pet name:", error);

    if (error instanceof Error && error.message.includes("401")) {
      return {
        success: false,
        message: "Authentication required - please log in to update pet name",
      };
    }

    if (error instanceof Error && error.message.includes("404")) {
      return {
        success: false,
        message: "No pet found - please create a pet first",
      };
    }

    return {
      success: false,
      message: `Failed to update pet name: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Delete pet
export async function deletePet(): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<VirtualPetResponse>(
      "/virtual-pet/delete",
      "DELETE"
    );

    return data;
  } catch (error) {
    console.error("Error deleting pet:", error);

    // Handle 401 as authentication issue
    if (error instanceof Error && error.message.includes("401")) {
      return {
        success: false,
        message: "Authentication required - please log in to delete pet",
      };
    }

    if (error instanceof Error && error.message.includes("404")) {
      return {
        success: false,
        message: "No pet found to delete",
      };
    }

    return {
      success: false,
      message: `Failed to delete pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// NEW API FUNCTIONS USING MOODLE TOKEN AUTHENTICATION

import { debugVirtualPetAuth } from "./debug-virtual-pet";

export interface PetCheckResponse {
  has_pet: boolean;
  message: string;
}

// Check if user has a pet using moodleToken authentication
export async function checkUserHasPet(): Promise<{
  success: boolean;
  data?: PetCheckResponse;
  message?: string;
}> {
  try {
    console.log("🔍 Checking if user has pet...");
    debugVirtualPetAuth(); // Add debugging information

    const data = await apiClient.request<PetCheckResponse>(
      "/virtual-pet/check-pet",
      "GET"
    );

    console.log("✅ Pet check successful:", data);
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("❌ Error checking pet status:", error);

    if (error instanceof Error && error.message.includes("401")) {
      return {
        success: false,
        message: "Authentication required - please log in",
      };
    }

    return {
      success: false,
      message: `Failed to check pet status: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Get user's pet using moodleToken authentication
export async function getUserPet(): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>("/virtual-pet/get-pet", "GET");

    return {
      success: true,
      has_pet: true,
      pet: data.pet,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching pet:", error);

    // Handle 404 as a normal case for users without pets
    if (error instanceof Error && error.message.includes("404")) {
      console.log(
        "No pet found for user (404) - this is normal for first-time users"
      );
      return {
        success: true,
        has_pet: false,
        message: "No pet found - first time user",
      };
    }

    // Handle 401 as authentication issue
    if (error instanceof Error && error.message.includes("401")) {
      console.log("Not authenticated (401) - user may need to log in");
      return {
        success: false,
        has_pet: false,
        message: "Authentication required - please log in",
      };
    }

    return {
      success: false,
      has_pet: false,
      message: `Failed to fetch pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Create new pet using moodleToken authentication (for onboarding)
export async function createUserPet(
  name: string,
  species: string = "cat"
): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/create-pet",
      "POST",
      {
        name: name,
        species: species,
      }
    );

    return {
      success: true,
      pet: data.pet,
      message: data.message,
      is_new_pet: data.is_new_pet,
    };
  } catch (error) {
    console.error("Error creating pet:", error);

    if (error instanceof Error && error.message.includes("401")) {
      return {
        success: false,
        message: "Authentication required - please log in to create a pet",
      };
    }

    if (error instanceof Error && error.message.includes("400")) {
      return {
        success: false,
        message: "You already have a pet. You can only have one pet at a time.",
      };
    }

    return {
      success: false,
      message: `Failed to create pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
