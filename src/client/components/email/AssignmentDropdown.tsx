import React, { useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User, UserPlus } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
}

interface AssignmentDropdownProps {
  currentAssignee?: string;
  teamMembers: TeamMember[];
  onAssign: (memberId: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function AssignmentDropdown({
  currentAssignee,
  teamMembers,
  onAssign,
  disabled = false,
  className,
  size = "md",
}: AssignmentDropdownProps) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>(
    currentAssignee || "",
  );

  const handleAssign = useCallback(
    async (memberId: string) => {
      if (memberId === currentAssignee) return;

      setIsAssigning(true);
      try {
        await onAssign(memberId);
        setSelectedMember(memberId);
      } catch (error) {
        console.error("Failed to assign:", error);
        // Reset to previous value on error
        setSelectedMember(currentAssignee || "");
      } finally {
        setIsAssigning(false);
      }
    },
    [currentAssignee, onAssign],
  );

  const sizeClasses = {
    sm: "h-7 text-xs",
    md: "h-9 text-sm",
    lg: "h-11 text-base",
  };

  const currentMember = teamMembers.find((m) => m.id === selectedMember);

  return (
    <Select value={selectedMember} onValueChange={handleAssign}>
      <SelectTrigger
        className={cn(sizeClasses[size], className)}
        disabled={disabled || isAssigning}
      >
        <SelectValue placeholder="Assign to...">
          <div className="flex items-center gap-2">
            {currentMember ? (
              <>
                <User className="h-3 w-3" />
                <span className="truncate">{currentMember.name}</span>
              </>
            ) : (
              <>
                <UserPlus className="h-3 w-3" />
                <span className="text-muted-foreground">Unassigned</span>
              </>
            )}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span>Unassigned</span>
          </div>
        </SelectItem>
        {teamMembers.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center gap-2">
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{member.name}</span>
                {member.role && (
                  <span className="text-xs text-muted-foreground">
                    {member.role}
                  </span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Helper component for inline assignment in tables
export function InlineAssignment({
  emailId,
  currentAssignee,
  teamMembers,
  onAssign,
  className,
}: {
  emailId: string;
  currentAssignee?: string;
  teamMembers: TeamMember[];
  onAssign: (emailId: string, memberId: string) => Promise<void>;
  className?: string;
}) {
  const handleAssign = useCallback(
    async (memberId: string) => {
      await onAssign(emailId, memberId);
    },
    [emailId, onAssign],
  );

  return (
    <AssignmentDropdown
      currentAssignee={currentAssignee}
      teamMembers={teamMembers}
      onAssign={handleAssign}
      size="sm"
      className={className}
    />
  );
}
