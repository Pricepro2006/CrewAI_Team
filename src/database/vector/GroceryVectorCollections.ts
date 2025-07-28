/**
 * Grocery Vector Collections - ChromaDB collections for Walmart grocery agent
 * Manages vector storage for products, recipes, and shopping patterns
 */

import type { ChromaDBManager, CollectionConfig } from "./ChromaDBManager.js";
import { logger } from "../../utils/logger.js";

export interface ProductVector {
  product_id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  search_text: string;
  price_range: "budget" | "mid" | "premium";
  dietary_tags: string[];
}

export interface RecipeVector {
  recipe_id: string;
  name: string;
  ingredients: string[];
  cuisine_type: string;
  meal_type: string;
  prep_time: number;
  difficulty: "easy" | "medium" | "hard";
  dietary_info: string[];
}

export interface ShoppingPatternVector {
  pattern_id: string;
  user_id: string;
  pattern_type: "weekly" | "monthly" | "seasonal";
  common_items: string[];
  shopping_frequency: number;
  average_spend: number;
}

export class GroceryVectorCollections {
  private chromaManager: ChromaDBManager;

  // Collection configurations
  private readonly COLLECTIONS: Record<string, CollectionConfig> = {
    walmart_products: {
      name: "walmart_products",
      description: "Vector embeddings for Walmart grocery products",
      metadataSchema: {
        product_id: {
          type: "string",
          required: true,
          description: "Walmart product ID",
        },
        name: { type: "string", required: true, description: "Product name" },
        brand: {
          type: "string",
          required: false,
          description: "Product brand",
        },
        category: {
          type: "string",
          required: true,
          description: "Product category",
        },
        department: {
          type: "string",
          required: false,
          description: "Store department",
        },
        price: {
          type: "number",
          required: false,
          description: "Current price",
        },
        in_stock: {
          type: "boolean",
          required: false,
          description: "Stock availability",
        },
        dietary_tags: {
          type: "array",
          required: false,
          description: "Dietary information tags",
        },
        allergens: {
          type: "array",
          required: false,
          description: "Allergen information",
        },
      },
    },

    recipes: {
      name: "recipes",
      description: "Vector embeddings for recipes and meal ideas",
      metadataSchema: {
        recipe_id: {
          type: "string",
          required: true,
          description: "Recipe identifier",
        },
        name: { type: "string", required: true, description: "Recipe name" },
        cuisine_type: {
          type: "string",
          required: false,
          description: "Cuisine category",
        },
        meal_type: {
          type: "string",
          required: false,
          description: "Meal type (breakfast, lunch, dinner)",
        },
        prep_time: {
          type: "number",
          required: false,
          description: "Preparation time in minutes",
        },
        servings: {
          type: "number",
          required: false,
          description: "Number of servings",
        },
        difficulty: {
          type: "string",
          required: false,
          description: "Recipe difficulty level",
        },
        dietary_info: {
          type: "array",
          required: false,
          description: "Dietary compatibility",
        },
        total_cost: {
          type: "number",
          required: false,
          description: "Estimated total cost",
        },
      },
    },

    shopping_patterns: {
      name: "shopping_patterns",
      description: "User shopping patterns and preferences",
      metadataSchema: {
        user_id: {
          type: "string",
          required: true,
          description: "User identifier",
        },
        pattern_type: {
          type: "string",
          required: true,
          description: "Pattern classification",
        },
        frequency: {
          type: "number",
          required: false,
          description: "Shopping frequency (times per month)",
        },
        avg_spend: {
          type: "number",
          required: false,
          description: "Average spending amount",
        },
        preferred_day: {
          type: "string",
          required: false,
          description: "Preferred shopping day",
        },
        store_preference: {
          type: "string",
          required: false,
          description: "Preferred store location",
        },
      },
    },

    substitutions: {
      name: "substitutions",
      description: "Product substitution mappings and preferences",
      metadataSchema: {
        original_product_id: {
          type: "string",
          required: true,
          description: "Original product ID",
        },
        substitute_product_id: {
          type: "string",
          required: true,
          description: "Substitute product ID",
        },
        similarity_score: {
          type: "number",
          required: true,
          description: "Similarity score (0-1)",
        },
        price_difference: {
          type: "number",
          required: false,
          description: "Price difference",
        },
        substitution_reason: {
          type: "string",
          required: false,
          description: "Reason for substitution",
        },
        user_rating: {
          type: "number",
          required: false,
          description: "User rating of substitution",
        },
      },
    },

    meal_plans: {
      name: "meal_plans",
      description: "Weekly meal plans and shopping lists",
      metadataSchema: {
        plan_id: {
          type: "string",
          required: true,
          description: "Meal plan identifier",
        },
        user_id: {
          type: "string",
          required: false,
          description: "Associated user",
        },
        week_start: {
          type: "string",
          required: true,
          description: "Week start date",
        },
        total_recipes: {
          type: "number",
          required: true,
          description: "Number of recipes",
        },
        estimated_cost: {
          type: "number",
          required: false,
          description: "Estimated weekly cost",
        },
        dietary_focus: {
          type: "array",
          required: false,
          description: "Dietary considerations",
        },
        cuisine_variety: {
          type: "array",
          required: false,
          description: "Cuisine types included",
        },
      },
    },
  };

  constructor(chromaManager: ChromaDBManager) {
    this.chromaManager = chromaManager;
  }

  /**
   * Initialize all grocery-related collections
   */
  async initializeCollections(): Promise<void> {
    logger.info(
      "Initializing grocery vector collections...",
      "GROCERY_VECTORS",
    );

    for (const [key, config] of Object.entries(this.COLLECTIONS)) {
      try {
        await this.chromaManager.createCollection(config);
        logger.info(`Created/verified collection: ${key}`, "GROCERY_VECTORS");
      } catch (error) {
        logger.error(
          `Failed to create collection ${key}: ${error}`,
          "GROCERY_VECTORS",
        );
        throw error;
      }
    }

    logger.info(
      "All grocery vector collections initialized",
      "GROCERY_VECTORS",
    );
  }

  /**
   * Add product to vector database
   */
  async addProduct(product: ProductVector): Promise<void> {
    const collection =
      await this.chromaManager.getCollection("walmart_products");

    const document = {
      id: product.product_id,
      content: `${product.name} ${product.brand} ${product.description} ${product.search_text}`,
      metadata: {
        product_id: product.product_id,
        name: product.name,
        brand: product.brand || "",
        category: product.category,
        dietary_tags: product.dietary_tags || [],
        price_range: product.price_range,
      },
    };

    await this.chromaManager.addDocuments("walmart_products", [document]);
  }

  /**
   * Search for similar products
   */
  async searchSimilarProducts(
    query: string,
    filters?: {
      category?: string;
      priceRange?: string;
      dietaryTags?: string[];
    },
    limit: number = 10,
  ): Promise<ProductVector[]> {
    const whereClause: any = {};

    if (filters?.category) {
      whereClause.category = filters.category;
    }

    if (filters?.priceRange) {
      whereClause.price_range = filters.priceRange;
    }

    if (filters?.dietaryTags && filters.dietaryTags.length > 0) {
      whereClause.dietary_tags = { $in: filters.dietaryTags };
    }

    const results = await this.chromaManager.query("walmart_products", {
      queryText: query,
      nResults: limit,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    return results.map((result) => ({
      product_id: result.metadata.product_id as string,
      name: result.metadata.name as string,
      brand: result.metadata.brand as string,
      category: result.metadata.category as string,
      description: result.content,
      search_text: "",
      price_range: result.metadata.price_range as "budget" | "mid" | "premium",
      dietary_tags: result.metadata.dietary_tags as string[],
    }));
  }

  /**
   * Add recipe to vector database
   */
  async addRecipe(recipe: RecipeVector): Promise<void> {
    const document = {
      id: recipe.recipe_id,
      content: `${recipe.name} ${recipe.cuisine_type} ${recipe.meal_type} ingredients: ${recipe.ingredients.join(" ")}`,
      metadata: {
        recipe_id: recipe.recipe_id,
        name: recipe.name,
        cuisine_type: recipe.cuisine_type,
        meal_type: recipe.meal_type,
        prep_time: recipe.prep_time,
        difficulty: recipe.difficulty,
        dietary_info: recipe.dietary_info,
        ingredients: recipe.ingredients,
      },
    };

    await this.chromaManager.addDocuments("recipes", [document]);
  }

  /**
   * Find recipes by ingredients
   */
  async findRecipesByIngredients(
    ingredients: string[],
    dietaryRestrictions?: string[],
    limit: number = 5,
  ): Promise<RecipeVector[]> {
    const query = `recipe with ${ingredients.join(" and ")}`;
    const whereClause: any = {};

    if (dietaryRestrictions && dietaryRestrictions.length > 0) {
      whereClause.dietary_info = { $all: dietaryRestrictions };
    }

    const results = await this.chromaManager.query("recipes", {
      queryText: query,
      nResults: limit,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    return results.map((result) => ({
      recipe_id: result.metadata.recipe_id as string,
      name: result.metadata.name as string,
      ingredients: result.metadata.ingredients as string[],
      cuisine_type: result.metadata.cuisine_type as string,
      meal_type: result.metadata.meal_type as string,
      prep_time: result.metadata.prep_time as number,
      difficulty: result.metadata.difficulty as "easy" | "medium" | "hard",
      dietary_info: result.metadata.dietary_info as string[],
    }));
  }

  /**
   * Store user shopping pattern
   */
  async storeShoppingPattern(pattern: ShoppingPatternVector): Promise<void> {
    const document = {
      id: pattern.pattern_id,
      content: `User ${pattern.user_id} ${pattern.pattern_type} shopping pattern: ${pattern.common_items.join(" ")}`,
      metadata: {
        user_id: pattern.user_id,
        pattern_type: pattern.pattern_type,
        frequency: pattern.shopping_frequency,
        avg_spend: pattern.average_spend,
        common_items: pattern.common_items,
      },
    };

    await this.chromaManager.addDocuments("shopping_patterns", [document]);
  }

  /**
   * Get user shopping recommendations
   */
  async getUserRecommendations(
    userId: string,
    currentList: string[],
  ): Promise<string[]> {
    // Find similar shopping patterns
    const patterns = await this.chromaManager.query("shopping_patterns", {
      queryText: currentList.join(" "),
      nResults: 5,
      where: { user_id: userId },
    });

    // Extract commonly purchased items not in current list
    const recommendations = new Set<string>();

    for (const pattern of patterns) {
      const commonItems = pattern.metadata.common_items as string[];
      for (const item of commonItems) {
        if (!currentList.includes(item)) {
          recommendations.add(item);
        }
      }
    }

    return Array.from(recommendations).slice(0, 10);
  }

  /**
   * Find product substitutions
   */
  async findSubstitutions(
    productId: string,
    pricePreference?: "cheaper" | "similar" | "any",
  ): Promise<
    {
      substitute_id: string;
      similarity: number;
      price_difference: number;
      reason: string;
    }[]
  > {
    const whereClause: any = { original_product_id: productId };

    const results = await this.chromaManager.query("substitutions", {
      queryText: productId,
      nResults: 5,
      where: whereClause,
    });

    return results
      .map((result) => ({
        substitute_id: result.metadata.substitute_product_id as string,
        similarity: result.metadata.similarity_score as number,
        price_difference: result.metadata.price_difference as number,
        reason: result.metadata.substitution_reason as string,
      }))
      .filter((sub) => {
        if (pricePreference === "cheaper") return sub.price_difference < 0;
        if (pricePreference === "similar")
          return Math.abs(sub.price_difference) < 1;
        return true;
      })
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Clean up old patterns
   */
  async cleanupOldPatterns(daysOld: number = 180): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // This would need to be implemented based on ChromaDB's capabilities
    // for now returning 0
    logger.info(
      `Cleanup of patterns older than ${daysOld} days requested`,
      "GROCERY_VECTORS",
    );
    return 0;
  }
}
