import {
  BookOpen,
  Clapperboard,
  Gamepad2,
  GraduationCap,
  Megaphone,
  Scissors,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { FeatureSlug } from "./features";

export const featureIcons: Record<FeatureSlug, LucideIcon> = {
  "ai-video-generator": Clapperboard,
  "fictional-character-videos": Users,
  "ai-story-videos": BookOpen,
  "gameplay-videos": Gamepad2,
  "educational-explainers": GraduationCap,
  "podcast-clipping": Scissors,
  "ai-marketing-videos": Megaphone,
};
