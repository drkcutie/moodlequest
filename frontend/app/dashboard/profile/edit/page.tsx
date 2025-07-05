"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchUserProfile } from "@/lib/profile-service"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAppToast } from "@/hooks/use-react-hot-toast"
import { motion } from "framer-motion"
import { ArrowLeft, Check } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"

export default function ProfileEditPage() {
  const { user } = useAuth()
  const { success, error: showError, info } = useAppToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    bio: "",
    email: "",
    profileImage: "",
    socialMedia: {
      twitter: "",
      github: ""
    },
    preferences: {
      emailNotifications: true,
      darkMode: true
    }
  })

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return

      try {
        setLoading(true)
        const data = await fetchUserProfile(user)
        
        if (data) {
          setProfileData(data)
          
          // Initialize form with existing data
          setFormData({
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            bio: "", // Bio not available in ProfileData, keep as empty
            email: data.email || user.email || "",
            profileImage: data.profile_image_url || "",
            socialMedia: {
              twitter: "", // Social media not available in ProfileData
              github: ""
            },
            preferences: {
              emailNotifications: true, // Preferences not available in ProfileData, use defaults
              darkMode: true
            }
          })
        }
      } catch (error) {
        console.error("Failed to load profile:", error)
        showError("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Handle nested objects
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as object),
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSave = async () => {
    if (!user) return
    
    try {
      setSaving(true)
      
      // Only update allowed fields
      const updateData = {
        userId: user.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        bio: formData.bio,
        email: formData.email,
        socialMedia: formData.socialMedia,
        preferences: formData.preferences
      }
      
      // Call API to update profile
      // In a real app, you'd send this to your server
      console.log("Saving profile data:", updateData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Update Moodle user data where possible
      try {
        await apiClient.storeUser({
          moodleId: user.moodleId,
          username: user.username,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          token: user.token
        })
      } catch (e) {
        console.warn("Non-critical: Failed to update Moodle profile", e)
      }
      
      success("Profile updated successfully")
      
      // Navigate back to profile
      router.push("/dashboard/profile")
    } catch (error) {
      console.error("Failed to save profile:", error)
      showError("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-16">
            <div className="flex justify-center items-center">
              <div className="w-8 h-8 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container max-w-3xl mx-auto py-8 px-4"
    >
      <motion.div variants={itemVariants} className="mb-6">
        <Link href="/dashboard/profile">
          <Button variant="ghost" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Edit Your Profile</CardTitle>
            <CardDescription>
              Update your personal information and preferences
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Profile Image */}
            <div className="flex flex-col items-center">
              <Avatar className="h-24 w-24">
                {formData.profileImage ? (
                  <AvatarImage src={formData.profileImage} alt={user?.name || ""} />
                ) : null}
                <AvatarFallback>{formData.firstName?.[0] || user?.name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <p className="text-sm text-muted-foreground mt-2">
                Profile image is managed through your Moodle account
              </p>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter your first name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Write a short bio about yourself"
                  rows={4}
                />
              </div>
            </div>

            {/* Social Media */}
            <div className="space-y-4">
              <h3 className="font-medium">Social Media</h3>
              
              <div className="space-y-2">
                <Label htmlFor="socialMedia.twitter">Twitter</Label>
                <Input
                  id="socialMedia.twitter"
                  name="socialMedia.twitter"
                  value={formData.socialMedia.twitter}
                  onChange={handleChange}
                  placeholder="Your Twitter username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="socialMedia.github">GitHub</Label>
                <Input
                  id="socialMedia.github"
                  name="socialMedia.github"
                  value={formData.socialMedia.github}
                  onChange={handleChange}
                  placeholder="Your GitHub username"
                />
              </div>
            </div>

            {/* Non-editable information */}
            <div className="space-y-4">
              <h3 className="font-medium">Account Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">Username cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user?.role || "Student"}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">Role is managed by your institution</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moodleId">Moodle ID</Label>
                <Input
                  id="moodleId"
                  value={user?.moodleId || ""}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">System identifier for your Moodle account</p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/profile")}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-t-2 border-b-2 border-current rounded-full animate-spin"></div>
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  )
} 