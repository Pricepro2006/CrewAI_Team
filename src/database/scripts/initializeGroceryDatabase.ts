/**
 * Initialize Grocery Database Script
 * Sets up the database schema and initial data for the Walmart grocery agent
 */

import { getDatabaseManager } from "../DatabaseManager.js";
import { getGroceryDataService } from "../services/GroceryDataService.js";
import { getGroceryFileStorage } from "../storage/GroceryFileStorage.js";
import { logger } from "../../utils/logger.js";

async function initializeGroceryDatabase() {
  logger.info("Initializing Grocery Database...", "GROCERY_INIT");

  try {
    // Step 1: Initialize the database manager
    const dbManager = getDatabaseManager();
    await dbManager.initialize();
    logger.info("Database manager initialized", "GROCERY_INIT");

    // Step 2: Initialize grocery data service
    const groceryService = getGroceryDataService();
    await groceryService.initialize();
    logger.info("Grocery data service initialized", "GROCERY_INIT");

    // Step 3: Initialize file storage
    const fileStorage = getGroceryFileStorage();
    await fileStorage.initialize();
    logger.info("File storage initialized", "GROCERY_INIT");

    // Step 4: Create sample data for testing
    await createSampleData(dbManager, groceryService);

    // Step 5: Verify database integrity
    const health = await dbManager.healthCheck();
    logger.info(
      `Database health check: ${JSON.stringify(health, null, 2)}`,
      "GROCERY_INIT",
    );

    // Step 6: Get statistics
    const stats = await dbManager.getStatistics();
    logger.info(
      `Database statistics: ${JSON.stringify(stats, null, 2)}`,
      "GROCERY_INIT",
    );

    logger.info(
      "Grocery database initialization completed successfully!",
      "GROCERY_INIT",
    );
  } catch (error) {
    logger.error(
      `Grocery database initialization failed: ${error}`,
      "GROCERY_INIT",
    );
    throw error;
  }
}

async function createSampleData(dbManager: any, groceryService: any) {
  logger.info("Creating sample data...", "GROCERY_INIT");

  try {
    // Check if sample data already exists
    const existingUsers = await dbManager?.users?.count();
    if (existingUsers > 1) {
      logger.info("Sample data already exists, skipping...", "GROCERY_INIT");
      return;
    }

    // Create a test user
    const testUser = await dbManager?.users?.createUser({
      email: "grocery.test@crewai-team.local",
      name: "Grocery Test User",
      role: "user",
      status: "active",
      permissions: ["grocery.manage"],
    });
    logger.info(`Created test user: ${testUser.id}`, "GROCERY_INIT");

    // Create user preferences
    await groceryService.updateUserPreferences(testUser.id, {
      dietary_restrictions: ["vegetarian"],
      preferred_organic: true,
      price_sensitivity: "medium",
      monthly_budget: 500,
      typical_shop_day: "Saturday",
      allow_substitutions: true,
      assistant_personality: "friendly",
      onboarding_completed: true,
    });
    logger.info("Created user preferences", "GROCERY_INIT");

    // Create sample Walmart products
    const sampleProducts = [
      {
        product_id: "WM_001",
        name: "Organic Bananas",
        brand: "Fresh Produce",
        description: "Fresh organic bananas, sold by pound",
        category_path: "Produce/Fruits/Bananas",
        department: "Produce",
        current_price: 0.69,
        regular_price: 0.79,
        unit_price: 0.69,
        unit_measure: "lb",
        in_stock: true,
        stock_level: 150,
        average_rating: 4.5,
        review_count: 234,
        allergens: [],
        search_keywords: "banana fruit organic produce yellow",
      },
      {
        product_id: "WM_002",
        name: "Whole Milk",
        brand: "Great Value",
        description: "Vitamin D whole milk, 1 gallon",
        category_path: "Dairy/Milk/Whole Milk",
        department: "Dairy",
        current_price: 3.98,
        regular_price: 4.29,
        unit_price: 3.98,
        unit_measure: "gallon",
        in_stock: true,
        stock_level: 75,
        average_rating: 4.2,
        review_count: 567,
        allergens: ["milk"],
        search_keywords: "milk dairy whole vitamin d gallon",
      },
      {
        product_id: "WM_003",
        name: "Whole Wheat Bread",
        brand: "Nature's Own",
        description: "100% whole wheat bread, 20oz loaf",
        category_path: "Bakery/Bread/Whole Wheat",
        department: "Bakery",
        current_price: 2.48,
        regular_price: 2.98,
        unit_price: 0.124,
        unit_measure: "oz",
        in_stock: true,
        stock_level: 120,
        average_rating: 4.4,
        review_count: 890,
        allergens: ["wheat", "gluten"],
        search_keywords: "bread wheat whole grain bakery loaf",
      },
      {
        product_id: "WM_004",
        name: "Large Eggs",
        brand: "Eggland's Best",
        description: "Grade A large eggs, dozen",
        category_path: "Dairy/Eggs/Large Eggs",
        department: "Dairy",
        current_price: 3.24,
        regular_price: 3.99,
        unit_price: 0.27,
        unit_measure: "egg",
        in_stock: true,
        stock_level: 200,
        average_rating: 4.6,
        review_count: 1234,
        allergens: ["eggs"],
        search_keywords: "eggs large dozen grade a protein breakfast",
      },
      {
        product_id: "WM_005",
        name: "Chicken Breast",
        brand: "Tyson",
        description: "Boneless skinless chicken breast, per pound",
        category_path: "Meat/Poultry/Chicken",
        department: "Meat",
        current_price: 3.99,
        regular_price: 4.49,
        unit_price: 3.99,
        unit_measure: "lb",
        in_stock: true,
        stock_level: 80,
        average_rating: 4.3,
        review_count: 456,
        allergens: [],
        search_keywords: "chicken breast meat poultry protein tyson boneless",
      },
    ];

    for (const product of sampleProducts) {
      await dbManager?.walmartProducts?.upsertProduct(product);
    }
    logger.info(
      `Created ${sampleProducts?.length || 0} sample products`,
      "GROCERY_INIT",
    );

    // Create a sample grocery list
    const { list, items } = await groceryService.createGroceryList({
      userId: testUser.id,
      listName: "Weekly Groceries",
      description: "Regular weekly shopping list",
      budgetLimit: 100,
      items: [
        { name: "Bananas", quantity: 2, notes: "Get organic if available" },
        { name: "Milk", quantity: 1, brand: "Great Value" },
        { name: "Bread", quantity: 1, notes: "Whole wheat preferred" },
        { name: "Eggs", quantity: 1 },
        { name: "Chicken", quantity: 2, notes: "2 pounds" },
      ],
    });
    logger.info(`Created sample grocery list: ${list.id}`, "GROCERY_INIT");

    // Create a recurring list template
    const recurringList = await dbManager?.groceryLists?.createList({
      user_id: testUser.id,
      list_name: "Essentials Template",
      description: "Recurring items bought every week",
      list_type: "template",
      is_recurring: true,
      recurrence_pattern: {
        frequency: "weekly",
        dayOfWeek: 6, // Saturday
        startDate: new Date().toISOString(),
      },
    });

    // Add items to recurring list
    const essentialItems = ["Milk", "Bread", "Eggs", "Bananas", "Yogurt"];
    for (const itemName of essentialItems) {
      await dbManager?.groceryItems?.addItem({
        list_id: recurringList.id,
        item_name: itemName,
        quantity: 1,
        priority: "essential",
      });
    }
    logger.info(
      `Created recurring list template: ${recurringList.id}`,
      "GROCERY_INIT",
    );

    logger.info("Sample data creation completed", "GROCERY_INIT");
  } catch (error) {
    logger.error(`Failed to create sample data: ${error}`, "GROCERY_INIT");
    throw error;
  }
}

// Run the initialization
if (require.main === module) {
  initializeGroceryDatabase()
    .then(() => {
      logger.info(
        "Grocery database initialization script completed",
        "GROCERY_INIT",
      );
      process.exit(0);
    })
    .catch((error: any) => {
      logger.error(`Script failed: ${error}`, "GROCERY_INIT");
      process.exit(1);
    });
}

export { initializeGroceryDatabase };
