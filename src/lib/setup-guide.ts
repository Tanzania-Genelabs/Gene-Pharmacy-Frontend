import type { Role } from "@/types";

export type GuideStepId = "branch" | "product" | "stock" | "sell";

export interface GuideStep {
  id: GuideStepId;
  /** Short name used in the roadmap. */
  label: string;
  /** Headline shown on the coach card. */
  title: string;
  /** The "why": what this step is for, in plain words. */
  why: string;
  /** What to actually click, in order. */
  how: string[];
  /** Page (relative to the pharmacy) where the step happens. */
  path: string;
  /** CSS selector(s) of the buttons to make glow on that page. */
  target: string;
  /** Said when the step is finished. */
  done: string;
  /** Roles that take this step. */
  roles: Role[];
}

const OWNER_UP: Role[] = ["SuperAdmin", "Owner"];
const MANAGER_UP: Role[] = ["SuperAdmin", "Owner", "Manager"];
const EVERYONE: Role[] = ["SuperAdmin", "Owner", "Manager", "Seller"];

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "branch",
    label: "Create a branch",
    title: "Create your first branch",
    why: "A branch is a physical shop or store room. Stock, sales and staff all belong to a branch, so nothing can be stocked or sold until one exists. Even with a single shop, create one - for example \"Main Shop\". Later you can add more and move stock between them.",
    how: ["Click the glowing \"Add Branch\" button.", "Type a name (like \"Main Shop\") and your city, then save."],
    path: "branches",
    target: '[data-guide="add-branch"]',
    done: "Branch created! Now you have somewhere to keep stock.",
    roles: OWNER_UP,
  },
  {
    id: "product",
    label: "Add products",
    title: "Add your products",
    why: "Products (drugs) are the things you sell: name, price and unit. The shared catalogue already knows thousands of products, so you only set your own price. Can't find yours? Add it yourself. This is only the list of products - it does not say how many you have yet.",
    how: [
      "Easiest: click \"Add from catalog\", tick the products you stock and enter your selling price.",
      "Or click \"Add Drug\" to type one in yourself (name, unit and price).",
    ],
    path: "drugs",
    target: '[data-guide="add-from-catalog"], [data-guide="add-drug"]',
    done: "Products added! Next, tell the app how many you actually have.",
    roles: MANAGER_UP,
  },
  {
    id: "stock",
    label: "Add stock",
    title: "Tell the app what you have in stock",
    why: "A product with no stock cannot be sold. Adjusting stock puts a quantity into a branch (and an expiry date, so you get warned before medicine expires). Later, deliveries from suppliers and sales keep this number up to date for you.",
    how: [
      "Click the glowing \"Adjust Stock\" button.",
      "Choose the product and the branch, then enter how many you have.",
      "Add the expiry date if you know it, and save.",
    ],
    path: "inventory",
    target: '[data-guide="adjust-stock"]',
    done: "Stock recorded! Your shelves now exist in the app.",
    roles: MANAGER_UP,
  },
  {
    id: "sell",
    label: "Make a sale",
    title: "Make your first sale",
    why: "Every sale is recorded against one branch and takes stock from it. So always check the Branch box first - it decides which shop's stock is used and whose sales report it appears in.",
    how: [
      "Pick the branch you are selling from in the Branch box.",
      "Search for a product (or tap it in the list) to add it to the cart.",
      "Enter the amount paid and click \"Complete Sale\".",
    ],
    path: "sales",
    target: '[data-guide="sales-branch"]',
    done: "First sale done. You know the whole loop now!",
    roles: EVERYONE,
  },
];

/** A seller cannot create branches or products, so for them the lesson is simply how the till works. */
const SELLER_SELL: Partial<GuideStep> = {
  title: "Open Sales and find the till",
  done: "You found the till. You're ready to sell!",
};

export function stepsForRole(role: Role | undefined | null): GuideStep[] {
  if (!role) return [];
  return GUIDE_STEPS.filter((s) => s.roles.includes(role)).map((s) => (role === "Seller" && s.id === "sell" ? { ...s, ...SELLER_SELL } : s));
}
