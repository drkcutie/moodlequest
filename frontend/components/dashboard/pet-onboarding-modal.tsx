import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Sparkles, Heart, Loader2 } from "lucide-react";

interface PetOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePet: (name: string, species: string) => Promise<void>;
  isLoading?: boolean;
}

const availableSpecies = [
  { id: "cat", name: "Cat", emoji: "🐱", description: "Playful and independent" },
  { id: "dog", name: "Dog", emoji: "🐶", description: "Loyal and energetic" },
  { id: "dragon", name: "Dragon", emoji: "🐉", description: "Mystical and powerful" },
  { id: "owl", name: "Owl", emoji: "🦉", description: "Wise and mysterious" },
  { id: "fox", name: "Fox", emoji: "🦊", description: "Clever and cunning" },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", description: "Gentle and quick" },
  { id: "hamster", name: "Hamster", emoji: "🐹", description: "Small and adorable" },
];

export function PetOnboardingModal({ 
  isOpen, 
  onClose, 
  onCreatePet, 
  isLoading = false 
}: PetOnboardingModalProps) {
  const [petName, setPetName] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState("cat");
  const [step, setStep] = useState<'welcome' | 'create' | 'customize'>('welcome');

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('create');
    } else if (step === 'create') {
      setStep('customize');
    }
  };

  const handleBack = () => {
    if (step === 'create') {
      setStep('welcome');
    } else if (step === 'customize') {
      setStep('create');
    }
  };

  const handleCreatePet = async () => {
    if (!petName.trim()) return;
    
    await onCreatePet(petName.trim(), selectedSpecies);
  };

  const selectedSpeciesData = availableSpecies.find(s => s.id === selectedSpecies) || availableSpecies[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        {step === 'welcome' && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-2xl">Welcome to Virtual Pets! 🎉</DialogTitle>
              <DialogDescription className="text-center text-base leading-relaxed">
                Your learning journey just got more exciting! Get ready to adopt your very own virtual learning companion.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-6">
              <div className="grid grid-cols-1 gap-4">
                <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <Heart className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Care & Bond</h3>
                    <p className="text-sm text-muted-foreground">
                      Feed, play, and interact with your pet as you learn
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-dashed border-green-500/20 bg-green-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white text-sm font-bold">XP</span>
                    </div>
                    <h3 className="font-semibold mb-1">Grow Together</h3>
                    <p className="text-sm text-muted-foreground">
                      Your pet levels up as you complete quests and earn XP
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-dashed border-blue-500/20 bg-blue-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white text-xs">🎨</span>
                    </div>
                    <h3 className="font-semibold mb-1">Customize</h3>
                    <p className="text-sm text-muted-foreground">
                      Unlock accessories and customize your pet's appearance
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button onClick={handleNext} size="lg" className="px-8">
                Let's Get Started! 🚀
              </Button>
            </div>
          </>
        )}

        {step === 'create' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Your Companion</DialogTitle>
              <DialogDescription>
                Select a species for your virtual learning companion
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                {availableSpecies.map((species) => (
                  <Card 
                    key={species.id}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      selectedSpecies === species.id 
                        ? 'ring-2 ring-primary bg-primary/10' 
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedSpecies(species.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-4xl mb-2">{species.emoji}</div>
                      <h3 className="font-semibold">{species.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {species.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleNext}>
                Next: Name Your Pet
              </Button>
            </div>
          </>
        )}

        {step === 'customize' && (
          <>
            <DialogHeader>
              <DialogTitle>Name Your {selectedSpeciesData.name}</DialogTitle>
              <DialogDescription>
                Give your learning companion a special name
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="text-8xl mb-4">{selectedSpeciesData.emoji}</div>
                <p className="text-sm text-muted-foreground">
                  Your {selectedSpeciesData.name} is ready to start this journey with you!
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="petName">Pet Name</Label>
                <Input
                  id="petName"
                  placeholder="Enter a name for your pet..."
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && petName.trim() && handleCreatePet()}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Choose a name that inspires you to learn! You can change it later.
                </p>
              </div>
              
              <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-green-600" />
                    <div>
                      <h4 className="font-semibold text-green-800">Pro Tip!</h4>
                      <p className="text-sm text-green-700">
                        Your pet will be happiest when you're actively learning. Complete quests to keep them healthy and happy!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                Back
              </Button>
              <Button 
                onClick={handleCreatePet} 
                disabled={!petName.trim() || isLoading}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create My Pet! 🎉'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
