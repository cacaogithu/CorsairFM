import { useState } from "react";
import { ChevronDown, Palette } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

const FONTS = [
  { value: "montserrat", label: "Montserrat" },
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "open-sans", label: "Open Sans" },
  { value: "lato", label: "Lato" },
];

const PLATFORMS = [
  { value: "none", label: "No specific platform" },
  { value: "amazon", label: "Amazon Product" },
  { value: "ebay", label: "eBay Listing" },
  { value: "instagram", label: "Instagram Post" },
];

export interface BrandSettingsData {
  font: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  gradientColor: string;
  customPrompt?: string;
  platform?: string;
}

interface BrandSettingsProps {
  settings: BrandSettingsData;
  onChange: (settings: BrandSettingsData) => void;
}

export const BrandSettings = ({ settings, onChange }: BrandSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof BrandSettingsData, value: string) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <span>Brand Settings</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="font">Font</Label>
            <Select
              value={settings.font}
              onValueChange={(value) => handleChange("font", value)}
            >
              <SelectTrigger id="font">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange("primaryColor", e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange("primaryColor", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) =>
                    handleChange("secondaryColor", e.target.value)
                  }
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.secondaryColor}
                  onChange={(e) =>
                    handleChange("secondaryColor", e.target.value)
                  }
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="textColor">Text Color</Label>
              <div className="flex gap-2">
                <Input
                  id="textColor"
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => handleChange("textColor", e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.textColor}
                  onChange={(e) => handleChange("textColor", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gradientColor">Gradient Color</Label>
              <div className="flex gap-2">
                <Input
                  id="gradientColor"
                  type="color"
                  value={settings.gradientColor}
                  onChange={(e) =>
                    handleChange("gradientColor", e.target.value)
                  }
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.gradientColor}
                  onChange={(e) =>
                    handleChange("gradientColor", e.target.value)
                  }
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform">Platform Optimization</Label>
            <Select
              value={settings.platform || "none"}
              onValueChange={(value) => handleChange("platform", value)}
            >
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((platform) => (
                  <SelectItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optimize images for specific marketplace requirements
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customPrompt">Custom Instructions (Optional)</Label>
            <Textarea
              id="customPrompt"
              placeholder="Add any specific instructions for the AI editor (e.g., 'Make the text bold and prominent', 'Use a modern aesthetic')"
              value={settings.customPrompt || ""}
              onChange={(e) => handleChange("customPrompt", e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              These instructions will guide the AI when editing your images
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
