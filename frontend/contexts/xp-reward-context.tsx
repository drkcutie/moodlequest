import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { XPRewardPopup } from "@/components/ui/xp-reward-popup";
import {
  useRealtimeXPReward,
  XPRewardData,
} from "@/hooks/use-realtime-xp-reward";

interface XPRewardContextValue {
  isVisible: boolean;
  rewardData: XPRewardData | null;
  queueLength: number;
  isConnected: boolean;
  showXPReward: (data: XPRewardData) => void;
  triggerXPReward: (
    xpEarned: number,
    taskTitle: string,
    totalXP: number,
    sourceType?: string
  ) => void;
  createRewardData: (
    xpEarned: number,
    taskTitle: string,
    totalXP: number,
    sourceType?: string,
    isRealTime?: boolean
  ) => XPRewardData;
  clearQueue: () => void;
  // New methods for managing onboarding state
  setOnboardingInProgress: (inProgress: boolean) => void;
  isOnboardingInProgress: boolean;
}

const XPRewardContext = createContext<XPRewardContextValue | undefined>(
  undefined
);

interface XPRewardProviderProps {
  children: ReactNode;
}

export function XPRewardProvider({ children }: XPRewardProviderProps) {
  const [isOnboardingInProgress, setIsOnboardingInProgress] = useState(true); // Start as true to block initial rewards
  const [queuedRewards, setQueuedRewards] = useState<XPRewardData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    isVisible,
    rewardData,
    queueLength,
    isConnected,
    showXPReward: originalShowXPReward,
    hideXPReward,
    triggerXPReward: originalTriggerXPReward,
    createRewardData,
    clearQueue,
  } = useRealtimeXPReward();

  // Modified showXPReward that respects onboarding state
  const showXPReward = (data: XPRewardData) => {
    console.log("XP reward triggered:", {
      taskTitle: data.taskTitle,
      xpEarned: data.xpEarned,
      isOnboardingInProgress,
      isInitialized,
    });

    if (isOnboardingInProgress || !isInitialized) {
      // Queue the reward if onboarding is in progress or not initialized
      setQueuedRewards((prev) => {
        const newQueue = [...prev, data];
        console.log(
          "XP reward queued:",
          data.taskTitle,
          "Queue length:",
          newQueue.length
        );
        return newQueue;
      });
    } else {
      // Show immediately if onboarding is not in progress and initialized
      console.log("XP reward showing immediately:", data.taskTitle);
      originalShowXPReward(data);
    }
  };

  // Modified triggerXPReward that respects onboarding state
  const triggerXPReward = (
    xpEarned: number,
    taskTitle: string,
    totalXP: number,
    sourceType?: string
  ) => {
    const rewardData = createRewardData(
      xpEarned,
      taskTitle,
      totalXP,
      sourceType
    );
    showXPReward(rewardData);
  };

  // Custom setOnboardingInProgress that also handles initialization
  const setOnboardingProgressWithInit = (inProgress: boolean) => {
    console.log("Setting onboarding progress:", inProgress);
    setIsOnboardingInProgress(inProgress);
    if (!isInitialized) {
      setIsInitialized(true);
    }
  };

  // Process queued rewards when onboarding completes
  useEffect(() => {
    if (!isOnboardingInProgress && isInitialized && queuedRewards.length > 0) {
      console.log(
        `Processing ${queuedRewards.length} queued XP rewards after onboarding`
      );
      // Show the first queued reward after a short delay
      setTimeout(() => {
        const firstReward = queuedRewards[0];
        if (firstReward) {
          console.log("Showing queued reward:", firstReward.taskTitle);
          originalShowXPReward(firstReward);
          setQueuedRewards((prev) => prev.slice(1));
        }
      }, 1000); // 1 second delay after onboarding completes
    }
  }, [
    isOnboardingInProgress,
    isInitialized,
    queuedRewards,
    originalShowXPReward,
  ]);

  // Process remaining queued rewards sequentially
  useEffect(() => {
    if (
      !isOnboardingInProgress &&
      isInitialized &&
      !isVisible &&
      queuedRewards.length > 0
    ) {
      // Show next reward after current one closes
      setTimeout(() => {
        const nextReward = queuedRewards[0];
        if (nextReward) {
          console.log("Showing next queued reward:", nextReward.taskTitle);
          originalShowXPReward(nextReward);
          setQueuedRewards((prev) => prev.slice(1));
        }
      }, 500); // Small delay between rewards
    }
  }, [
    isVisible,
    isOnboardingInProgress,
    isInitialized,
    queuedRewards,
    originalShowXPReward,
  ]);

  // Clear queued rewards when component unmounts or user changes
  useEffect(() => {
    return () => {
      setQueuedRewards([]);
    };
  }, []);

  const contextValue: XPRewardContextValue = {
    isVisible,
    rewardData,
    queueLength,
    isConnected,
    showXPReward,
    triggerXPReward,
    createRewardData,
    clearQueue,
    setOnboardingInProgress: setOnboardingProgressWithInit,
    isOnboardingInProgress,
  };

  return (
    <XPRewardContext.Provider value={contextValue}>
      {children}
      {/* Global XP Reward Popup */}
      {rewardData && (
        <XPRewardPopup
          isOpen={isVisible}
          onCloseAction={hideXPReward}
          xpEarned={rewardData.xpEarned}
          taskTitle={rewardData.taskTitle}
          currentXP={rewardData.currentXP}
          previousXP={rewardData.previousXP}
          currentLevel={rewardData.currentLevel}
          xpToNextLevel={rewardData.xpToNextLevel}
          maxXP={rewardData.maxXP}
        />
      )}
    </XPRewardContext.Provider>
  );
}

// Hook to use the XP reward context
export function useXPRewardContext() {
  const context = useContext(XPRewardContext);
  if (context === undefined) {
    throw new Error(
      "useXPRewardContext must be used within an XPRewardProvider"
    );
  }
  return context;
}

// Backward compatibility hook that mimics the original useXPReward interface
export function useGlobalXPReward() {
  const context = useXPRewardContext();

  return {
    isVisible: context.isVisible,
    rewardData: context.rewardData,
    showXPReward: context.showXPReward,
    hideXPReward: () => {
      // Hide functionality is handled internally by the provider
      console.log("hideXPReward called - popup will close automatically");
    },
    createRewardData: context.createRewardData,
    // Additional real-time features
    triggerXPReward: context.triggerXPReward,
    queueLength: context.queueLength,
    isConnected: context.isConnected,
    clearQueue: context.clearQueue,
    // New onboarding management features
    setOnboardingInProgress: context.setOnboardingInProgress,
    isOnboardingInProgress: context.isOnboardingInProgress,
  };
}
