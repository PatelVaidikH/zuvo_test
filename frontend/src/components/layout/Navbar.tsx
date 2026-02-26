"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Search, LogOut, ChevronDown, User as UserIcon } from "lucide-react";
import { getInitials } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  if (!user) return null;

  const displayName =
    user.role === "super_admin"
      ? "Zuvo Admin"
      : user.company_name || "Company Workspace";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LEFT: Logo & Company Name */}
        <div className="flex items-center gap-3">
          {/* Logo updated to use the new Sage Green (primary) */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="font-bold text-primary-foreground text-lg leading-none">
              Z
            </span>
          </div>
          <span className="font-semibold text-lg tracking-tight text-foreground">
            {displayName}
          </span>
        </div>

        {/* MIDDLE: Search Command Bar */}
        <div className="hidden flex-1 items-center justify-center px-8 md:flex">
          <button
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="group flex h-9 w-full max-w-md items-center justify-between rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-all hover:border-primary hover:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Search
                className={`h-4 w-4 transition-colors ${isSearchFocused ? "text-primary" : "text-muted-foreground"}`}
              />
              <span>Search teams, tasks, or users...</span>
            </div>
            <kbd className="hidden rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-secondary-foreground opacity-100 sm:block">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* RIGHT: User Profile Dropdown */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all hover:opacity-80">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name}
                  width={36}
                  height={36}
                  className="rounded-full object-cover shadow-sm border border-border"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-medium text-sm border border-border shadow-sm">
                  {getInitials(user.full_name)}
                </div>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 mt-2 rounded-xl bg-card border-border shadow-lg"
            >
              <DropdownMenuLabel className="flex flex-col space-y-1">
                <span className="text-sm font-medium leading-none text-foreground">
                  {user.full_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
                <div className="mt-2 inline-flex items-center w-fit rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground border border-border">
                  {user.role.replace("_", " ").toUpperCase()}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem className="cursor-pointer gap-2 py-2 text-foreground focus:bg-secondary">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer gap-2 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
