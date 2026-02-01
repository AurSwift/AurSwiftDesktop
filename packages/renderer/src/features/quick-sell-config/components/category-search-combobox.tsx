/**
 * Category Search Combobox
 *
 * Searchable dropdown for selecting categories to link to quick sell buttons.
 */

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/shared/hooks/use-auth";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("category-search-combobox");

interface Category {
  id: string;
  name: string;
  color?: string | null;
  parentId?: string | null;
}

interface CategorySearchComboboxProps {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function CategorySearchCombobox({
  selectedCategoryId,
  onSelect,
}: CategorySearchComboboxProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      if (!user?.businessId) return;

      try {
        setIsLoading(true);
        const response = await window.categoryAPI.getByBusiness(
          user.businessId
        );

        if (response.success && response.categories) {
          setCategories(response.categories);
        } else {
          setCategories([]);
        }
      } catch (error) {
        logger.error("Error loading categories:", error);
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, [user?.businessId]);

  // Client-side filtering with memoization and limit
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories.slice(0, 50); // Limit to first 50 when no search

    const query = searchQuery.toLowerCase();
    return categories
      .filter((category) => category.name.toLowerCase().includes(query))
      .slice(0, 50); // Limit to first 50 matches
  }, [categories, searchQuery]);

  // Get selected category
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCategory ? (
            <span className="flex items-center gap-2">
              <FolderOpen
                className="w-4 h-4"
                style={{ color: selectedCategory.color || undefined }}
              />
              {selectedCategory.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a category...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search categories..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading categories...
              </div>
            ) : filteredCategories.length === 0 ? (
              <CommandEmpty>
                {searchQuery
                  ? "No categories found. Try a different search."
                  : categories.length === 0
                    ? "No categories available."
                    : "Start typing to search categories..."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {/* Clear selection option */}
                {selectedCategoryId && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                    className="text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      Clear selection
                    </span>
                  </CommandItem>
                )}
                {filteredCategories.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.id}
                    onSelect={() => {
                      onSelect(category.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCategoryId === category.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <FolderOpen
                      className="mr-2 h-4 w-4"
                      style={{ color: category.color || undefined }}
                    />
                    <span>{category.name}</span>
                  </CommandItem>
                ))}
                {searchQuery && filteredCategories.length === 50 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                    Showing first 50 results. Refine your search for more.
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
