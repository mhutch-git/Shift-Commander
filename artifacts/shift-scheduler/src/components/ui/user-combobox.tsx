import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface UserOption {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface UserComboboxProps {
  users: UserOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra item prepended before the user list, e.g. "Myself" */
  prefixOption?: { value: string; label: string };
}

export function UserCombobox({
  users,
  value,
  onChange,
  placeholder = "Select a person…",
  prefixOption,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);

  function labelFor(val: string) {
    if (prefixOption && val === prefixOption.value) return prefixOption.label;
    const u = users.find((u) => String(u.id) === val);
    return u ? `${u.firstName} ${u.lastName}` : placeholder;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 px-3 text-sm"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? labelFor(value) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search name…" />
          <CommandList>
            <CommandEmpty>No person found.</CommandEmpty>
            <CommandGroup>
              {prefixOption && (
                <CommandItem
                  key={prefixOption.value}
                  value={prefixOption.label}
                  onSelect={() => { onChange(prefixOption.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === prefixOption.value ? "opacity-100" : "opacity-0")} />
                  {prefixOption.label}
                </CommandItem>
              )}
              {users.map((u) => {
                const val = String(u.id);
                const label = `${u.firstName} ${u.lastName}`;
                return (
                  <CommandItem
                    key={val}
                    value={label}
                    onSelect={() => { onChange(val); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === val ? "opacity-100" : "opacity-0")} />
                    {label}
                    {u.role === "reserve" && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(Reserve)</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
