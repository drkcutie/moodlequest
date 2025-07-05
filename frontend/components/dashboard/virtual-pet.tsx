"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppToast } from "@/hooks/use-react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import type {
  VirtualPet as VirtualPetType,
  PetAccessory,
} from "@/types/gamification";
import { Heart, Zap, Clock, Plus, Lock, Edit2, Check, X } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyPet, VirtualPetData, updatePetName } from "@/lib/virtual-pet-api";

// Mock pet accessories
const availableAccessories: PetAccessory[] = [
  {
    id: "bed",
    name: "Cat Mattress",
    description: "A cozy bed designed for optimal rest.",
    slot: "background",
    iconUrl: "/pet-access/bed.png",
    levelRequired: 10,
    position: {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "0",
      opacity: "0.8",
      width: "140px",
      height: "140px",
      top: "30px",
      left: "-10px",
    },
    stats: {
      energyBoost: 10,
    },
  },
  {
    id: "pole",
    name: "Scratch Pole",
    description: "A scratching post for exercise.",
    slot: "left",
    iconUrl: "/pet-access/pole.png",
    levelRequired: 15,
    position: {
      position: "absolute",
      width: "50px",
      height: "100px",
      left: "-150px", // moved even more to the left
      bottom: "10px",
      zIndex: "1",
    },
    stats: {
      happinessBoost: 15,
    },
  },
  {
    id: "kitten",
    name: "Friend (Kitten)",
    description: "A companion for your virtual pet.",
    slot: "bottom-left",
    iconUrl: "/pet-access/kitten.png",
    levelRequired: 25,
    position: {
      position: "absolute",
      width: "40px",
      height: "40px",
      left: "-90px",
      bottom: "0px",
      zIndex: "2",
    },
    stats: {
      happinessBoost: 20,
    },
  },
  {
    id: "bowl",
    name: "Food Bowl",
    description: "A special feeding bowl.",
    slot: "bottom-right",
    iconUrl: "/pet-access/food.png",
    levelRequired: 30,
    position: {
      position: "absolute",
      width: "40px",
      height: "40px",
      right: "-150px", // moved even more to the right
      bottom: "10px", // adjusted to be more aligned with other items
      zIndex: "2",
    },
    stats: {
      energyBoost: 15,
    },
  },
];

// Mock pet data
const mockPet: VirtualPetType = {
  id: "pet1",
  name: "Derrick",
  species: "Owl",
  level: 20,
  experience: 1580,
  experienceToNextLevel: 2000,
  happiness: 10,
  energy: 10,
  lastFed: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
  lastPlayed: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
  accessories: [], // No accessories initially since level is too low
  iconUrl: "/animations/Chilling.gif",
};

export function VirtualPet() {
  const { success, error: showError } = useAppToast();
  
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pet, setPet] = useState<VirtualPetType | null>(null);

  const [activeTab, setActiveTab] = useState("interact");
  const [showAccessories, setShowAccessories] = useState(false);
  const [petState, setPetState] = useState<
    "idle" | "chilling" | "eating" | "playing" | "dancing" | "crying" | "dead"
  >("chilling");
  const [isFeeding, setIsFeeding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const userActivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const feedingTimeout = useRef<NodeJS.Timeout | null>(null);
  const playingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Helper function to convert backend pet data to frontend format
  const convertBackendPetToFrontend = (
    backendPet: VirtualPetData
  ): VirtualPetType => {
    return {
      id: backendPet.pet_id.toString(),
      name: backendPet.name,
      species: backendPet.species,
      level: 1, // Default level since backend doesn't have this
      experience: 0, // Default experience since backend doesn't have this
      experienceToNextLevel: 100, // Default next level requirement
      happiness: backendPet.happiness,
      energy: backendPet.energy,
      lastFed: backendPet.last_fed,
      lastPlayed: backendPet.last_played,
      accessories: backendPet.accessories || [], // Use backend accessories or empty array
      iconUrl: "/animations/Chilling.gif", // Default animation
    };
  };

  // Fetch pet data from API
  useEffect(() => {
    const fetchPetData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("VirtualPet: Fetching pet data from API...");
        const response = await getMyPet();

        console.log("VirtualPet: API response:", response);

        if (response.success && response.has_pet && response.pet) {
          // Convert backend pet data to frontend format
          const frontendPet = convertBackendPetToFrontend(response.pet);
          setPet(frontendPet);
          setNewPetName(frontendPet.name);
          console.log("VirtualPet: Successfully loaded pet:", frontendPet);
        } else if (response.success && !response.has_pet) {
          // User doesn't have a pet - this component shouldn't be shown
          console.log("VirtualPet: No pet found for user");
          setError("No pet found. Please create a pet first.");
        } else {
          console.error("VirtualPet: Failed to fetch pet:", response.message);
          setError(response.message || "Failed to load pet data");
        }
      } catch (err) {
        console.error("VirtualPet: Error fetching pet:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load pet data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPetData();
  }, []);

  // Calculate time since last interaction
  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) {
      return "Less than an hour ago";
    } else if (diffHrs === 1) {
      return "1 hour ago";
    } else {
      return `${diffHrs} hours ago`;
    }
  };
  // Handle Feed Pet button click
  const handleFeedClick = () => {
    if (!pet || pet.energy >= 100) return; // Don't feed if energy is full or no pet

    setIsFeeding(true);
    const previousState = petState;

    // Update pet stats
    setPet((prevPet) => {
      if (!prevPet) return prevPet;
      return {
        ...prevPet,
        energy: Math.min(100, prevPet.energy + 20),
        lastFed: new Date().toISOString(),
        experience: prevPet.experience + 15, // Gain experience when feeding
      };
    });

    // Clear any existing timeout
    if (feedingTimeout.current) {
      clearTimeout(feedingTimeout.current);
    }

    // Reset after animation duration
    feedingTimeout.current = setTimeout(() => {
      setIsFeeding(false);
      setPetState(previousState);
      updatePetState();
    }, 3000);
  };
  // Handle Play button click
  const handlePlayClick = () => {
    if (!pet || pet.energy <= 0) return; // Don't play if no energy or no pet

    setIsPlaying(true);
    const previousState = petState;

    // Update pet stats
    setPet((prevPet) => {
      if (!prevPet) return prevPet;
      return {
        ...prevPet,
        happiness: Math.min(100, prevPet.happiness + 15),
        energy: Math.max(0, prevPet.energy - 10),
        lastPlayed: new Date().toISOString(),
        experience: prevPet.experience + 25, // Gain more experience when playing
      };
    });

    // Clear any existing timeout
    if (playingTimeout.current) {
      clearTimeout(playingTimeout.current);
    }

    // Reset after animation duration
    playingTimeout.current = setTimeout(() => {
      setIsPlaying(false);
      setPetState(previousState);
      updatePetState();
    }, 3000);
  };

  // Handle saving the pet name
  const handleSaveName = async () => {
    if (!pet) return;

    if (!newPetName.trim()) {
      // If empty, revert to current name
      setNewPetName(pet.name);
      setIsEditingName(false);
      return;
    }

    // Don't update if name hasn't changed
    if (newPetName.trim() === pet.name) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsUpdatingName(true);
      console.log("Updating pet name from", pet.name, "to", newPetName.trim());

      const response = await updatePetName(newPetName.trim());

      if (response.success && response.pet) {
        // Update the pet state with the new name from the API response
        setPet((prevPet) => {
          if (!prevPet) return prevPet;
          return {
            ...prevPet,
            name: response.pet!.name, // Use the name from the API response
          };
        });
        
        console.log("Pet name updated successfully to:", response.pet.name);
        success(`Pet name updated to "${response.pet.name}"`);
        setIsEditingName(false);
      } else {
        console.error("Failed to update pet name:", response.message);
        // Revert to original name on failure
        setNewPetName(pet.name);
        showError(`Failed to update pet name: ${response.message}`);
      }
    } catch (error) {
      console.error("Error updating pet name:", error);
      // Revert to original name on error
      setNewPetName(pet.name);
      showError("Failed to update pet name. Please try again.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const equipAccessory = (accessory: PetAccessory) => {
    if (!pet) return;

    // Check if the pet level is high enough to use this accessory
    if (pet.level < accessory.levelRequired) {
      return; // Can't equip if level requirement isn't met
    }
    setPet((prevPet) => {
      if (!prevPet) return prevPet;

      // Check if accessory is already equipped
      const isEquipped = prevPet.accessories.some(
        (acc) => acc.id === accessory.id
      );

      if (isEquipped) {
        // Remove the accessory
        return {
          ...prevPet,
          accessories: prevPet.accessories.filter(
            (acc) => acc.id !== accessory.id
          ),
          happiness: Math.max(0, prevPet.happiness - 5), // Small happiness penalty for removing
        };
      } else {
        // Add the accessory
        return {
          ...prevPet,
          accessories: [...prevPet.accessories, accessory],
          happiness: Math.min(100, prevPet.happiness + 5), // Small happiness boost for adding
        };
      }
    });
  };

  // Determine the appropriate pet state based on current conditions
  const updatePetState = () => {
    if (!pet) return;

    if (pet.energy <= 0) {
      setPetState("dead");
    } else if (pet.happiness <= 10) {
      setPetState("crying");
    } else if (pet.happiness >= 100) {
      setPetState("dancing");
    } else if (pet.energy >= 100) {
      setPetState("dancing");
    } else {
      // Default to chilling when active, idle when inactive
      setPetState("chilling");
    }
  };

  // Helper to calculate levels needed to unlock an accessory
  const getLevelsNeeded = (accessory: PetAccessory) => {
    if (!pet) return accessory.levelRequired;
    return Math.max(0, accessory.levelRequired - pet.level);
  };

  // Set up user activity tracking
  useEffect(() => {
    const resetUserActivity = () => {
      // User is active
      setPetState((prevState) => {
        // Only change to chilling if not in a special state
        if (["idle", "chilling"].includes(prevState)) {
          return "chilling";
        }
        return prevState;
      });

      // Clear existing timeout
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
      }

      // Set up new timeout to mark as idle after inactivity
      userActivityTimeout.current = setTimeout(() => {
        setPetState((prevState) => {
          // Only change to idle if currently chilling
          if (prevState === "chilling") {
            return "idle";
          }
          return prevState;
        });
      }, 10000); // 30 seconds of inactivity
    };

    // Add event listeners for user activity
    window.addEventListener("mousemove", resetUserActivity);
    window.addEventListener("keydown", resetUserActivity);
    window.addEventListener("click", resetUserActivity);
    window.addEventListener("touchstart", resetUserActivity);

    // Initial call to set up timeout
    resetUserActivity();

    return () => {
      // Clean up event listeners
      window.removeEventListener("mousemove", resetUserActivity);
      window.removeEventListener("keydown", resetUserActivity);
      window.removeEventListener("click", resetUserActivity);
      window.removeEventListener("touchstart", resetUserActivity);

      // Clear timeout
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
      }
    };
  }, []);

  // Update pet state whenever pet stats change
  useEffect(() => {
    if (pet) {
      updatePetState();
    }
  }, [pet?.happiness, pet?.energy]);

  // Check for level up when experience changes
  useEffect(() => {
    if (!pet) return;

    if (pet.experience >= pet.experienceToNextLevel) {
      // Level up the pet
      const newLevel = pet.level + 1;
      const remainingExp = pet.experience - pet.experienceToNextLevel;

      // Calculate experience needed for next level (increases with each level)
      const newExpRequired = Math.floor(pet.experienceToNextLevel * 1.2);

      setPet((prevPet) => {
        if (!prevPet) return prevPet;
        return {
          ...prevPet,
          level: newLevel,
          experience: remainingExp,
          experienceToNextLevel: newExpRequired,
          // Bonus happiness and energy for leveling up
          happiness: Math.min(100, prevPet.happiness + 20),
          energy: Math.min(100, prevPet.energy + 20),
        };
      });

      // Could add a level up animation or notification here
      console.log(`${pet.name} leveled up to level ${newLevel}!`);
    }
  }, [pet?.experience]);

  // Simulate pet stats decreasing over time
  useEffect(() => {
    const interval = setInterval(() => {
      setPet((prevPet) => {
        if (!prevPet) return prevPet;
        return {
          ...prevPet,
          happiness: Math.max(0, prevPet.happiness - 1),
          energy: Math.max(0, prevPet.energy - 0.5),
        };
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (feedingTimeout.current) clearTimeout(feedingTimeout.current);
      if (playingTimeout.current) clearTimeout(playingTimeout.current);
    };
  }, []);

  // Get the appropriate animation source based on current state
  const getPetAnimationSrc = () => {
    if (isFeeding) return "/animations/Happy.gif";
    if (isPlaying) return "/animations/Tickle.gif";

    switch (petState) {
      case "idle":
        return "/animations/Idle1.gif";
      case "dancing":
        return "/animations/Dancing.gif";
      case "crying":
        return "/animations/Crying.gif";
      case "dead":
        return "/animations/Dead.png";
      case "chilling":
      default:
        return "/animations/Chilling.gif";
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Pet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your pet...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error || !pet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Pet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-4">
                {error || "Failed to load pet"}
              </p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Virtual Pet</span>
          <span className="text-sm font-normal">Level {pet.level}</span>
        </CardTitle>
        <CardDescription>Take care of your learning companion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            {/* Background accessory */}
            {pet.accessories.find((acc) => acc.slot === "background") && (
              <div
                className="absolute"
                style={{
                  width: "140px",
                  height: "140px",
                  top: "0",
                  left: "-10px",
                  zIndex: "0",
                }}
              >
                <Image
                  src={
                    pet.accessories.find((acc) => acc.slot === "background")
                      ?.iconUrl || ""
                  }
                  alt="Pet bed"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
            )}

            {/* Pet with animations */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: "120px", height: "120px" }}
            >
              {/* Left accessory (pole) */}
              {pet.accessories.find((acc) => acc.slot === "left") && (
                <div
                  className="absolute"
                  style={{
                    width: "50px",
                    height: "100px",
                    left: "-60px",
                    bottom: "10px",
                    zIndex: "1",
                  }}
                >
                  <Image
                    src={
                      pet.accessories.find((acc) => acc.slot === "left")
                        ?.iconUrl || ""
                    }
                    alt="Scratch pole"
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
              )}
              {/* Bottom left accessory (kitten) */}
              {pet.accessories.find((acc) => acc.slot === "bottom-left") && (
                <div
                  className="absolute"
                  style={{
                    width: "40px",
                    height: "40px",
                    left: "-20px",
                    bottom: "0px",
                    zIndex: "2",
                  }}
                >
                  <Image
                    src={
                      pet.accessories.find((acc) => acc.slot === "bottom-left")
                        ?.iconUrl || ""
                    }
                    alt="Friend kitten"
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
              )}
              {/* Bottom right accessory (bowl) */}
              {pet.accessories.find((acc) => acc.slot === "bottom-right") && (
                <div
                  className="absolute"
                  style={{
                    width: "40px",
                    height: "40px",
                    right: "-20px",
                    bottom: "0px",
                    zIndex: "2",
                  }}
                >
                  <Image
                    src={
                      pet.accessories.find((acc) => acc.slot === "bottom-right")
                        ?.iconUrl || ""
                    }
                    alt="Food bowl"
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
              )}{" "}
              <Image
                src={getPetAnimationSrc()}
                alt={`${pet.name} the Cat`}
                width={120}
                height={120}
                priority
              />
            </div>
          </div>{" "}
          <div className="flex items-center justify-center text-xl font-bold mb-2 gap-2">
            {isEditingName ? (
              <div className="flex items-center">
                <Input
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  className="h-8 px-2 py-1 w-32 text-center font-bold"
                  autoFocus
                  disabled={isUpdatingName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isUpdatingName) {
                      handleSaveName();
                    } else if (e.key === "Escape") {
                      setNewPetName(pet.name);
                      setIsEditingName(false);
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-1"
                  onClick={handleSaveName}
                  disabled={isUpdatingName}
                  title="Save name"
                >
                  {isUpdatingName ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-1"
                  onClick={() => {
                    setNewPetName(pet.name);
                    setIsEditingName(false);
                  }}
                  disabled={isUpdatingName}
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>{pet.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setNewPetName(pet.name);
                    setIsEditingName(true);
                  }}
                  disabled={isUpdatingName}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>{" "}
          <div className="w-full space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-1 text-purple-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" />
                    <path d="M15 6h-6v12h6v-12z" />
                  </svg>
                  <span>Experience</span>
                </div>
                <span>
                  {pet.experience} / {pet.experienceToNextLevel}
                </span>
              </div>
              <Progress
                value={(pet.experience / pet.experienceToNextLevel) * 100}
                className="h-2 bg-purple-100 dark:bg-purple-900/20"
              >
                <div
                  className="bg-gradient-to-r from-purple-500 to-purple-700 h-full transition-all"
                  style={{
                    width: `${
                      (pet.experience / pet.experienceToNextLevel) * 100
                    }%`,
                  }}
                />
              </Progress>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <Heart className="h-4 w-4 mr-1 text-red-500" />
                  <span>Happiness</span>
                </div>
                <span>{pet.happiness}%</span>
              </div>
              <Progress value={pet.happiness} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                  <span>Energy</span>
                </div>
                <span>{pet.energy}%</span>
              </div>
              <Progress value={pet.energy} className="h-2" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last fed: {getTimeSince(pet.lastFed)}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last played: {getTimeSince(pet.lastPlayed)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Tabs
          defaultValue="interact"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="interact">Interact</TabsTrigger>
            <TabsTrigger value="customize">Customize</TabsTrigger>
          </TabsList>

          <TabsContent value="interact" className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleFeedClick}
                disabled={pet.energy >= 100 || isFeeding}
              >
                Feed Pet
              </Button>
              <Button
                onClick={handlePlayClick}
                disabled={pet.energy <= 0 || isPlaying}
              >
                Play
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="customize" className="pt-2">
            <Dialog open={showAccessories} onOpenChange={setShowAccessories}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Accessories
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] dark:bg-background dark:border dark:border-border">
                <DialogHeader>
                  <DialogTitle>Pet Accessories</DialogTitle>
                  <DialogDescription>
                    Customize your pet with special items that boost their stats
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 mt-4">
                  {availableAccessories.map((accessory) => {
                    const isEquipped = pet.accessories.some(
                      (acc) => acc.id === accessory.id
                    );
                    const isLocked = pet.level < accessory.levelRequired;
                    const levelsNeeded = getLevelsNeeded(accessory);
                    return (
                      <Button
                        key={accessory.id}
                        variant={isEquipped ? "default" : "outline"}
                        className={`flex flex-col items-center justify-between h-auto p-5 ${
                          isEquipped ? "bg-primary text-primary-foreground" : ""
                        } ${isLocked ? "opacity-80" : ""}`}
                        onClick={() => equipAccessory(accessory)}
                        disabled={isLocked}
                      >
                        <div className="relative w-16 h-16 mb-3">
                          <Image
                            src={accessory.iconUrl}
                            alt={accessory.name}
                            layout="fill"
                            objectFit="contain"
                            className={isLocked ? "opacity-50" : ""}
                          />
                          {isLocked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-background/80 dark:bg-background rounded-full p-1">
                                <Lock className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div
                          className={`text-sm font-medium mb-2 ${
                            isEquipped ? "text-white" : ""
                          }`}
                        >
                          {accessory.name}
                        </div>
                        <div
                          className={`text-xs ${
                            isEquipped
                              ? "text-white/90"
                              : "text-muted-foreground"
                          } text-center leading-relaxed w-full overflow-hidden break-words`}
                        >
                          {isLocked
                            ? `Unlocks at level ${accessory.levelRequired}`
                            : accessory.description}
                        </div>
                        <div
                          className={`text-xs font-medium mt-3 ${
                            isEquipped ? "text-white/90" : ""
                          }`}
                        >
                          {isLocked
                            ? `🔒 ${levelsNeeded} more level${
                                levelsNeeded !== 1 ? "s" : ""
                              } needed`
                            : isEquipped
                            ? "✓ Equipped"
                            : "Click to equip"}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </CardFooter>
    </Card>
  );
}
