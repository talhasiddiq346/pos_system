// One-off seed: rebrand to "Tandoor", create Tariq Road + Hussainabad Food Street
// branches (Main Branch already exists), wipe the old Lassi Shop catalog, and load
// the new 200-item menu — merging Half/Full/Small/Medium/Large/Jumbo name-suffixed
// duplicates into a single product with real product_variants rows.
//
// Run: node scripts/seed-tandoor-menu.js            (uses backend/.env DATABASE_URL)
// Run against prod: DATABASE_URL=<prod url> node scripts/seed-tandoor-menu.js

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Raw menu as pasted (id/branch_id/image_url/created_at stripped — those are
// regenerated below: branch placement, variant merge, and category-matched images).
const RAW = [
  // Burgers & Sandwiches
  ["Fish Fillet Burger", 490, "Burgers & Sandwiches"],
  ["Zinger Burger Classic", 420, "Burgers & Sandwiches"],
  ["Smash Beef Burger", 550, "Burgers & Sandwiches"],
  ["Grilled Chicken Burger", 450, "Burgers & Sandwiches"],
  ["Club Sandwich Traditional", 420, "Burgers & Sandwiches"],
  ["BBQ Grilled Sandwich", 390, "Burgers & Sandwiches"],
  ["Double Decker Zinger", 590, "Burgers & Sandwiches"],
  ["Tower Crispy Burger", 490, "Burgers & Sandwiches"],
  ["Jalapeno Beef Melt", 580, "Burgers & Sandwiches"],
  ["Mushroom Swiss Beef", 620, "Burgers & Sandwiches"],
  ["Chapli Burger Deluxe", 320, "Burgers & Sandwiches"],
  ["Crispy Chicken Wrap", 340, "Burgers & Sandwiches"],
  ["BBQ Tikka Wrap", 350, "Burgers & Sandwiches"],
  ["Cheese Blast Omelet Sandwich", 280, "Burgers & Sandwiches"],
  ["Vegetarian Pesto Panini", 410, "Burgers & Sandwiches"],
  ["Spicy Patty Melt", 390, "Burgers & Sandwiches"],
  ["Texas Loaded Beef Burger", 680, "Burgers & Sandwiches"],
  ["Crispy Tender Roll", 290, "Burgers & Sandwiches"],
  ["Avocado Turkey Club", 520, "Burgers & Sandwiches"],
  ["Mexican Salsa Burger", 460, "Burgers & Sandwiches"],
  ["Triple Stacker Beef", 850, "Burgers & Sandwiches"],
  ["Philly Cheesesteak Sandwich", 640, "Burgers & Sandwiches"],
  ["Garlic Mayo Chicken Wrap", 320, "Burgers & Sandwiches"],
  ["Smoky Bacon Cheeseburger", 590, "Burgers & Sandwiches"],
  ["Egg & Cheese Breakfast Bun", 220, "Burgers & Sandwiches"],
  // Pizza
  ["Chicken Tikka Pizza Small", 450, "Pizza"],
  ["Pepperoni Feast Medium", 850, "Pizza"],
  ["Creamy Mughlai Pizza Large", 1350, "Pizza"],
  ["Veggie Supreme Pizza", 650, "Pizza"],
  ["Fajita Sensation Medium", 890, "Pizza"],
  ["Malai Boti Pizza Large", 1400, "Pizza"],
  ["Smoked BBQ Chicken Pizza", 950, "Pizza"],
  ["Margherita Classic Small", 380, "Pizza"],
  ["Beef Sicilian Pizza Large", 1500, "Pizza"],
  ["Fiery Hot Buffalo Pizza", 880, "Pizza"],
  ["Sriracha Chicken Pizza", 920, "Pizza"],
  ["Four Cheese Giga Pizza", 1250, "Pizza"],
  ["Tandoori Crust Hot Pizza", 980, "Pizza"],
  ["Crown Crust Masterpiece", 1650, "Pizza"],
  ["Euro Deluxe Pizza Medium", 890, "Pizza"],
  ["Deep Dish Meat Lover", 1750, "Pizza"],
  ["Hawaiian Delight Pizza", 820, "Pizza"],
  ["Creamy Ranch Special", 990, "Pizza"],
  ["Calzone Stuffed Pocket", 550, "Pizza"],
  ["Double Cheese Margherita", 720, "Pizza"],
  ["Afghani Feast Pizza", 1050, "Pizza"],
  ["Garlic Butter Crust Pizza", 870, "Pizza"],
  ["Spicy Sausage Pizza", 840, "Pizza"],
  ["Mushroom & Herb Pizza", 760, "Pizza"],
  ["Extreme Cheese Melt Pizza", 1450, "Pizza"],
  // Sides & Appetizers
  ["French Fries Regular", 180, "Sides & Appetizers"],
  ["Cheesy Loaded Fries", 490, "Sides & Appetizers"],
  ["Crispy Chicken Nuggets (6pcs)", 290, "Sides & Appetizers"],
  ["Chicken Tenders Bucket", 450, "Sides & Appetizers"],
  ["Garlic Cheese Bread", 260, "Sides & Appetizers"],
  ["Onion Rings Basket", 240, "Sides & Appetizers"],
  ["Mozzarella Sticks (5pcs)", 380, "Sides & Appetizers"],
  ["Buffalo Hot Wings (8pcs)", 490, "Sides & Appetizers"],
  ["Honey BBQ Wings (8pcs)", 490, "Sides & Appetizers"],
  ["Cheesy Potato Skins", 290, "Sides & Appetizers"],
  ["Dynamite Shots Basket", 520, "Sides & Appetizers"],
  ["Butter Corn on the Cob", 150, "Sides & Appetizers"],
  ["Seasoned Potato Wedges", 260, "Sides & Appetizers"],
  ["Fried Mushroom Caps", 340, "Sides & Appetizers"],
  ["Crunchy Coleslaw Cup", 120, "Sides & Appetizers"],
  ["Masala Curly Fries", 280, "Sides & Appetizers"],
  ["Spicy Chicken Bites", 320, "Sides & Appetizers"],
  ["Jalapeno Poppers", 360, "Sides & Appetizers"],
  ["Cheesy Garlic Knots", 230, "Sides & Appetizers"],
  ["BBQ Meatballs (6pcs)", 420, "Sides & Appetizers"],
  ["Sweet Potato Fries", 310, "Sides & Appetizers"],
  ["Garlic Mayo Dip Extra", 60, "Sides & Appetizers"],
  ["Honey Mustard Sauce Dip", 60, "Sides & Appetizers"],
  ["Spicy Mayo Dip Extra", 60, "Sides & Appetizers"],
  ["Extra Cheese Sauce Cup", 90, "Sides & Appetizers"],
  // Pasta
  ["Fettuccine Alfredo Fettuccine", 690, "Pasta"],
  ["Spicy Penne Arrabiata", 550, "Pasta"],
  ["Baked Mac & Cheese", 580, "Pasta"],
  ["Chicken Lasagna Supreme", 790, "Pasta"],
  ["Beef Bolognese Pasta", 720, "Pasta"],
  ["Creamy Pesto Chicken Pasta", 710, "Pasta"],
  ["Seafood Spaghetti Marinara", 890, "Pasta"],
  ["Creamy Carbonara Special", 760, "Pasta"],
  ["Spicy Cajun Chicken Pasta", 680, "Pasta"],
  ["Spinach & Ricotta Ravioli", 740, "Pasta"],
  ["Beef Meatball Spaghetti", 750, "Pasta"],
  ["Four Cheese Baked Penne", 690, "Pasta"],
  ["Vegetable Primavara Pasta", 520, "Pasta"],
  ["Chicken Parmesan Spaghetti", 820, "Pasta"],
  ["Truffle Mushroom Pasta", 920, "Pasta"],
  ["Spicy Jalapeno Cream Penne", 640, "Pasta"],
  ["Smoked Sausage Penne", 690, "Pasta"],
  ["Creamy Garlic Shrimp Fettuccine", 950, "Pasta"],
  ["Baked Beef Lasagna Rollup", 810, "Pasta"],
  ["Buffalo Chicken Pasta", 730, "Pasta"],
  ["Cheesy Chicken Macaroni", 590, "Pasta"],
  ["Roasted Red Pepper Pasta", 660, "Pasta"],
  ["Classic Tomato Spaghetti", 490, "Pasta"],
  ["BBQ Chicken Pasta Bake", 780, "Pasta"],
  ["Spinach Alfredo Fettuccine", 710, "Pasta"],
  // BBQ & Karahi
  ["Chicken Tikka Boti (Plate)", 480, "BBQ & Karahi"],
  ["Chicken Malai Boti (Plate)", 560, "BBQ & Karahi"],
  ["Beef Seekh Kebab (4pcs)", 520, "BBQ & Karahi"],
  ["Chicken Reshmi Kebab (4pcs)", 540, "BBQ & Karahi"],
  ["Chicken Karahi Half", 890, "BBQ & Karahi"],
  ["Chicken Karahi Full", 1650, "BBQ & Karahi"],
  ["Mutton Karahi Half", 1450, "BBQ & Karahi"],
  ["Mutton Karahi Full", 2800, "BBQ & Karahi"],
  ["Chicken White Handi Half", 980, "BBQ & Karahi"],
  ["Chicken White Handi Full", 1850, "BBQ & Karahi"],
  ["Beef Behari Kebab Plate", 620, "BBQ & Karahi"],
  ["Fish Tikka BBQ", 850, "BBQ & Karahi"],
  ["Chicken Green Karahi Half", 920, "BBQ & Karahi"],
  ["BBQ Platter Mix (Small)", 1850, "BBQ & Karahi"],
  ["BBQ Platter Mix (Jumbo)", 3400, "BBQ & Karahi"],
  ["Mutton Ribs Chops BBQ", 1650, "BBQ & Karahi"],
  ["Chicken Shinwari Karahi Full", 1750, "BBQ & Karahi"],
  ["Chicken Kastoori Boti", 590, "BBQ & Karahi"],
  ["Chicken Cheese Kebab (4pcs)", 610, "BBQ & Karahi"],
  ["Beef Dhaga Kebab Plate", 580, "BBQ & Karahi"],
  ["Chicken Makhni Handi Half", 990, "BBQ & Karahi"],
  ["Brain Masala Fry", 850, "BBQ & Karahi"],
  ["Peshawari Charsi Mutton Karahi", 2950, "BBQ & Karahi"],
  ["Roti Tandoori Fresh", 30, "BBQ & Karahi"],
  ["Garlic Naan Butter", 80, "BBQ & Karahi"],
  ["Rogan Naan Sesame", 90, "BBQ & Karahi"],
  ["Cheese Stuffed Naan", 250, "BBQ & Karahi"],
  ["Kachumar Salad Plate", 120, "BBQ & Karahi"],
  ["Zeera Raita Bowl", 100, "BBQ & Karahi"],
  ["Mint Raita Bowl", 100, "BBQ & Karahi"],
  // Beverages
  ["Pepsi Can 345ml", 100, "Beverages"],
  ["7Up Can 345ml", 100, "Beverages"],
  ["Mirinda Can 345ml", 100, "Beverages"],
  ["Mineral Water Small 500ml", 60, "Beverages"],
  ["Mineral Water Large 1.5L", 110, "Beverages"],
  ["Fresh Mint Lemonade", 220, "Beverages"],
  ["Pina Colada Chill", 350, "Beverages"],
  ["Cold Coffee Shake", 380, "Beverages"],
  ["Chocolate Fudge Milkshake", 420, "Beverages"],
  ["Oreo Crunch Shake", 450, "Beverages"],
  ["Strawberry Blast Shake", 390, "Beverages"],
  ["Mango Chiller Smoothie", 360, "Beverages"],
  ["Peach Iced Tea", 250, "Beverages"],
  ["Lemon Iced Tea", 240, "Beverages"],
  ["Blue Lagoon Mocktail", 320, "Beverages"],
  ["Hot Espresso Shot", 220, "Beverages"],
  ["Cappuccino Hot Coffee", 340, "Beverages"],
  ["Hot Milk Tea (Chai)", 120, "Beverages"],
  ["Kashmiri Green Tea", 150, "Beverages"],
  ["Pakistani Doodh Patti", 140, "Beverages"],
  ["KitKat Shake Supreme", 480, "Beverages"],
  ["Vanilla Bean Shake", 380, "Beverages"],
  ["Caramel Frappuccino", 460, "Beverages"],
  ["Red Bull Energy Can", 380, "Beverages"],
  ["Fresh Apple Juice", 280, "Beverages"],
  ["Fresh Orange Juice", 290, "Beverages"],
  ["Diet Pepsi Can 345ml", 110, "Beverages"],
  ["Sprite Zero Can 345ml", 110, "Beverages"],
  ["Margarita Slush Frozen", 310, "Beverages"],
  ["Sweet Lassi Kulhad", 180, "Beverages"],
  // Desserts
  ["Molten Lava Cake", 450, "Desserts"],
  ["Fudge Brownie with Ice Cream", 380, "Desserts"],
  ["New York Cheesecake Slice", 520, "Desserts"],
  ["Red Velvet Slice", 480, "Desserts"],
  ["Nutella Waffles Stacker", 590, "Desserts"],
  ["Classic Apple Pie Slice", 360, "Desserts"],
  ["Chocolate Chip Gelato Scoop", 180, "Desserts"],
  ["Vanilla Bean Scoop", 150, "Desserts"],
  ["Tiramisu Dessert Cup", 490, "Desserts"],
  ["Shahi Kheer Kulhad", 220, "Desserts"],
  ["Gulab Jamun (2pcs Hot)", 160, "Desserts"],
  ["Lotus Biscoff Cheesecake", 580, "Desserts"],
  ["Belgian Chocolate Crepe", 540, "Desserts"],
  ["Caramel Custard Pudding", 280, "Desserts"],
  ["Mango Tart Seasonal", 320, "Desserts"],
  ["Blueberry Cheesecake", 540, "Desserts"],
  ["Oreo Sundae Glass", 420, "Desserts"],
  ["Chocolate Donut Glazed", 180, "Desserts"],
  ["Boston Cream Donut", 200, "Desserts"],
  ["Churro Sticks with Fudge Dip", 350, "Desserts"],
  ["Pistachio Kulfi Slice", 210, "Desserts"],
  ["Zafrani Rasmalai (2pcs)", 290, "Desserts"],
  ["Nutella Donut", 240, "Desserts"],
  ["Strawberry Ice Cream Sundae", 380, "Desserts"],
  ["Double Chocolate Chip Cookie", 140, "Desserts"],
  ["Peanut Butter Brownie", 320, "Desserts"],
  ["Lemon Tart Sweet", 280, "Desserts"],
  ["Cinnamon Roll Classic", 290, "Desserts"],
  ["Saffron Phirni Pot", 240, "Desserts"],
  ["Hot Chocolate Lava Cookie", 390, "Desserts"],
  ["Chocolate Mousse Cup", 310, "Desserts"],
  ["Fudge Ice Cream Cake Slice", 460, "Desserts"],
  ["Pecan Pie Slice", 420, "Desserts"],
  ["Matcha Green Tea Scoop", 240, "Desserts"],
  ["Coconut Macaroon (3pcs)", 210, "Desserts"],
  ["Kulfi Falooda Glass", 380, "Desserts"],
  ["Rabri Jalebi Plate", 320, "Desserts"],
  ["Caramel Brownie Bite", 260, "Desserts"],
  ["Strawberry Tart", 310, "Desserts"],
  ["Royal Falooda Deluxe", 450, "Desserts"],
];

// ── Category-matched stock photo pools (varied — not the ~15 photos reused
// across all 200 rows in the original paste). Cycled per item within category.
const IMAGE_POOL = {
  "Burgers & Sandwiches": [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&q=80",
    "https://images.unsplash.com/photo-1521305916504-4a1121188589?w=600&q=80",
    "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80",
    "https://images.unsplash.com/photo-1610614819513-58e34989848b?w=600&q=80",
    "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80",
    "https://images.unsplash.com/photo-1567234669013-216f99097721?w=600&q=80",
    "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=600&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80",
  ],
  Pizza: [
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
    "https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=600&q=80",
    "https://images.unsplash.com/photo-1571066811602-71683a3f680d?w=600&q=80",
    "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=600&q=80",
    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=600&q=80",
  ],
  "Sides & Appetizers": [
    "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&q=80",
    "https://images.unsplash.com/photo-1569278563259-d3e91eb7041c?w=600&q=80",
    "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&q=80",
    "https://images.unsplash.com/photo-1639024471283-267a3fc7752f?w=600&q=80",
    "https://images.unsplash.com/photo-1531749668029-2db88e4b76ce?w=600&q=80",
    "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=600&q=80",
    "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=600&q=80",
    "https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=600&q=80",
  ],
  Pasta: [
    "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&q=80",
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80",
    "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=600&q=80",
    "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80",
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&q=80",
  ],
  "BBQ & Karahi": [
    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&q=80",
    "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80",
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
    "https://images.unsplash.com/photo-1628294896516-344152572658?w=600&q=80",
  ],
  Beverages: [
    "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80",
    "https://images.unsplash.com/photo-1560023907-5f339617ea30?w=600&q=80",
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80",
    "https://images.unsplash.com/photo-1546171753-97d7676e4182?w=600&q=80",
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80",
    "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80",
  ],
  Desserts: [
    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80",
    "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80",
    "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&q=80",
    "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&q=80",
    "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
  ],
};

const BANNER_URL = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80";

const SIZE_SUFFIXES = ["Half", "Full", "Small", "Medium", "Large", "Jumbo"];

function splitSize(name) {
  for (const suf of SIZE_SUFFIXES) {
    const re = new RegExp(`\\s+${suf}$`, "i");
    if (re.test(name)) return { base: name.replace(re, "").trim(), variant: suf };
  }
  return { base: name, variant: "Regular" };
}

// Merge same-flavor rows (identical base name + category) into one product
// with one product_variants row per distinct size found.
function buildMenu() {
  const byKey = new Map();
  let catCounters = {};
  for (const [rawName, price, category] of RAW) {
    const { base, variant } = splitSize(rawName);
    const key = `${category}::${base}`;
    if (!byKey.has(key)) {
      const idx = (catCounters[category] = (catCounters[category] || 0) + 1) - 1;
      const pool = IMAGE_POOL[category];
      byKey.set(key, {
        name: base,
        category,
        image_url: pool[idx % pool.length],
        variants: [],
      });
    }
    byKey.get(key).variants.push({ name: variant, price });
  }
  return [...byKey.values()];
}

// 70% common to all 3 branches, 10% exclusive to each branch.
function assignBranch(index, branchIds) {
  const [mainId, tariqId, hussainabadId] = branchIds;
  const bucket = index % 10;
  if (bucket === 0) return [mainId];
  if (bucket === 1) return [tariqId];
  if (bucket === 2) return [hussainabadId];
  return branchIds; // 7/10 = 70%
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Branches: keep existing Main Branch, add the two new ones.
    const { rows: mainRows } = await client.query(
      "SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1"
    );
    if (!mainRows.length) throw new Error("Main Branch not found");
    const mainId = mainRows[0].id;

    async function upsertBranch(name) {
      const { rows } = await client.query(
        "SELECT id FROM branches WHERE name = $1 LIMIT 1",
        [name]
      );
      if (rows.length) return rows[0].id;
      const ins = await client.query(
        "INSERT INTO branches (name) VALUES ($1) RETURNING id",
        [name]
      );
      return ins.rows[0].id;
    }
    const tariqId = await upsertBranch("Tariq Road");
    const hussainabadId = await upsertBranch("Hussainabad Food Street");
    const branchIds = [mainId, tariqId, hussainabadId];

    // 2. Wipe old catalog (variants/addon_groups cascade; order_items.product_id -> SET NULL).
    await client.query("DELETE FROM products");

    // 3. Rebrand.
    await client.query(
      `UPDATE site_settings
       SET brand_name = 'Tandoor',
           banner_images = $1::jsonb,
           updated_at = now()
       WHERE id = 1`,
      [JSON.stringify([{ image_url: BANNER_URL, public_id: null, link: null }])]
    );

    // 4. Insert products + variants per branch assignment.
    const menu = buildMenu();
    let productCount = 0;
    let variantCount = 0;

    for (let idx = 0; idx < menu.length; idx++) {
      const item = menu[idx];
      const targets = assignBranch(idx, branchIds);
      for (const branchId of targets) {
        const basePrice = item.variants[0].price;
        const { rows } = await client.query(
          `INSERT INTO products (branch_id, name, price, category, image_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [branchId, item.name, basePrice, item.category, item.image_url]
        );
        const productId = rows[0].id;
        productCount++;
        for (const v of item.variants) {
          await client.query(
            `INSERT INTO product_variants (product_id, name, price) VALUES ($1, $2, $3)`,
            [productId, v.name, v.price]
          );
          variantCount++;
        }
      }
    }

    await client.query("COMMIT");
    console.log(`Branches: Main=${mainId}, Tariq Road=${tariqId}, Hussainabad Food Street=${hussainabadId}`);
    console.log(`Unique menu items: ${menu.length}`);
    console.log(`Products inserted (across branches): ${productCount}`);
    console.log(`Variant rows inserted: ${variantCount}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
