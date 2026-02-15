/**
 * Database Utility for Neon PostgreSQL
 * 
 * Provides functions to interact with the Neon database for storing
 * and retrieving receipt data.
 * 
 * Includes MOCK MODE for local testing to save compute credits.
 */

import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config/database';
import { Receipt, ReceiptItem, ParsedReceipt } from '../types';

// Check for Mock Mode
const USE_MOCK_DB = process.env.EXPO_PUBLIC_USE_MOCK_DB === 'true';

// Create Neon SQL client (only if not mocking, or lazy load)
const sql = USE_MOCK_DB ? null : neon(DATABASE_URL);

// --- MOCK STORE (In-Memory for Session) ---
let mockReceipts: Receipt[] = [];
let mockIdCounter = 1;

/**
 * Initialize the database schema
 */
export async function initializeDatabase(): Promise<void> {
    if (USE_MOCK_DB) {
        console.log('[MOCK DB] Database initialized (InMemory)');
        return;
    }

    try {
        if (!sql) throw new Error("SQL client not initialized");

        // 1. Create receipts table
        await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        scan_date DATE DEFAULT CURRENT_DATE,
        store_name VARCHAR(255),
        subtotal DECIMAL(10, 2),
        tax DECIMAL(10, 2),
        total DECIMAL(10, 2),
        raw_text TEXT,
        json_data JSONB
      )
    `;

        // 2. Create receipt_items table
        await sql`
      CREATE TABLE IF NOT EXISTS receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER DEFAULT 1
      )
    `;

        // 3. Run Migrations (for existing tables)
        try {
            await sql`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_id TEXT`;
            await sql`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS json_data JSONB`;
        } catch (e) {
            console.log("Migration check passed or skipped");
        }

        // 4. Create indexes
        await sql`
      CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id 
      ON receipt_items(receipt_id)
    `;

        await sql`
      CREATE INDEX IF NOT EXISTS idx_receipts_scan_date 
      ON receipts(scan_date)
    `;

        await sql`
      CREATE INDEX IF NOT EXISTS idx_receipts_user_id 
      ON receipts(user_id)
    `;

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Save a receipt and its items
 */
export async function saveReceipt(receipt: ParsedReceipt, userId: string): Promise<Receipt> {
    if (USE_MOCK_DB) {
        console.log('[MOCK DB] Saving receipt for user:', userId);
        const newId = mockIdCounter++;
        const savedReceipt: Receipt = {
            id: newId,
            date: receipt.date || new Date().toISOString().split('T')[0],
            storeName: receipt.storeName || "Unknown Store",
            subtotal: receipt.subtotal,
            tax: receipt.tax,
            total: receipt.total,
            rawText: receipt.rawText,
            items: receipt.items.map((item, idx) => ({
                id: idx + 1,
                receiptId: newId,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1
            }))
        };
        mockReceipts.unshift(savedReceipt); // Add to top
        return savedReceipt;
    }

    try {
        if (!sql) throw new Error("SQL client not initialized");

        // Construct standard Core fields
        const storeName = receipt.storeName || null;
        const total = receipt.total || null;
        const scanDate = receipt.date || null;

        // Prepare Metadata Bag
        const metadata = {};

        // Construct the full JSON object
        const jsonData = {
            ...receipt,
            metadata,
        };

        // Insert the receipt
        const [insertedReceipt] = await sql`
      INSERT INTO receipts (
          user_id, 
          store_name, 
          subtotal, 
          tax, 
          total, 
          raw_text, 
          scan_date,
          json_data
      )
      VALUES (
          ${userId}, 
          ${storeName}, 
          ${receipt.subtotal || null}, 
          ${receipt.tax || null}, 
          ${total}, 
          ${receipt.rawText || null},
          ${scanDate},
          ${jsonData}
      )
      RETURNING id, created_at, scan_date, store_name, subtotal, tax, total, raw_text
    `;

        const receiptId = insertedReceipt.id;

        // Insert items
        if (receipt.items && receipt.items.length > 0) {
            for (const item of receipt.items) {
                await sql`
          INSERT INTO receipt_items (receipt_id, name, price, quantity)
          VALUES (${receiptId}, ${item.name}, ${item.price}, ${item.quantity || 1})
        `;
            }
        }

        // Return the saved receipt
        return {
            id: receiptId,
            date: insertedReceipt.scan_date,
            storeName: insertedReceipt.store_name,
            subtotal: insertedReceipt.subtotal ? parseFloat(insertedReceipt.subtotal) : undefined,
            tax: insertedReceipt.tax ? parseFloat(insertedReceipt.tax) : undefined,
            total: insertedReceipt.total ? parseFloat(insertedReceipt.total) : undefined,
            rawText: insertedReceipt.raw_text,
            items: receipt.items,
        };
    } catch (error) {
        console.error('Failed to save receipt:', error);
        throw error;
    }
}

/**
 * Get all receipts for a user
 */
export async function getAllReceipts(userId: string): Promise<Receipt[]> {
    if (USE_MOCK_DB) {
        console.log('[MOCK DB] Getting receipts for user:', userId);
        return [...mockReceipts];
    }

    try {
        if (!sql) throw new Error("SQL client not initialized");

        const receipts = await sql`
      SELECT id, scan_date, store_name, subtotal, tax, total
      FROM receipts
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

        return receipts.map(row => ({
            id: row.id,
            date: row.scan_date,
            storeName: row.store_name,
            subtotal: row.subtotal ? parseFloat(row.subtotal) : undefined,
            tax: row.tax ? parseFloat(row.tax) : undefined,
            total: row.total ? parseFloat(row.total) : undefined,
        }));
    } catch (error) {
        console.error('Failed to get receipts:', error);
        throw error;
    }
}

/**
 * Get a single receipt
 */
export async function getReceiptById(receiptId: number, userId: string): Promise<Receipt | null> {
    if (USE_MOCK_DB) {
        console.log('[MOCK DB] Getting receipt:', receiptId);
        const found = mockReceipts.find(r => r.id === receiptId);
        return found || null;
    }

    try {
        if (!sql) throw new Error("SQL client not initialized");

        // Get the receipt
        const [receipt] = await sql`
      SELECT id, scan_date, store_name, subtotal, tax, total, raw_text
      FROM receipts
      WHERE id = ${receiptId} AND user_id = ${userId}
    `;

        if (!receipt) {
            return null;
        }

        // Get the items
        const items = await sql`
      SELECT id, name, price, quantity
      FROM receipt_items
      WHERE receipt_id = ${receiptId}
      ORDER BY id
    `;

        return {
            id: receipt.id,
            date: receipt.scan_date,
            storeName: receipt.store_name,
            subtotal: receipt.subtotal ? parseFloat(receipt.subtotal) : undefined,
            tax: receipt.tax ? parseFloat(receipt.tax) : undefined,
            total: receipt.total ? parseFloat(receipt.total) : undefined,
            rawText: receipt.raw_text,
            items: items.map(item => ({
                id: item.id,
                receiptId: receiptId,
                name: item.name,
                price: parseFloat(item.price),
                quantity: item.quantity,
            })),
        };
    } catch (error) {
        console.error('Failed to get receipt:', error);
        throw error;
    }
}

/**
 * Delete a receipt
 */
export async function deleteReceipt(receiptId: number, userId: string): Promise<void> {
    if (USE_MOCK_DB) {
        console.log('[MOCK DB] Deleting receipt:', receiptId);
        mockReceipts = mockReceipts.filter(r => r.id !== receiptId);
        return;
    }

    try {
        if (!sql) throw new Error("SQL client not initialized");

        await sql`
      DELETE FROM receipts
      WHERE id = ${receiptId} AND user_id = ${userId}
    `;
    } catch (error) {
        console.error('Failed to delete receipt:', error);
        throw error;
    }
}

/**
 * Get receipt statistics
 */
export async function getReceiptStats(userId: string): Promise<{
    totalReceipts: number;
    totalSpent: number;
    averageTotal: number;
}> {
    if (USE_MOCK_DB) {
        console.log('[MOCK DB] Calculating stats');
        const totalReceipts = mockReceipts.length;
        const totalSpent = mockReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
        const averageTotal = totalReceipts > 0 ? totalSpent / totalReceipts : 0;

        return {
            totalReceipts,
            totalSpent,
            averageTotal
        };
    }

    try {
        if (!sql) throw new Error("SQL client not initialized");

        const [stats] = await sql`
      SELECT 
        COUNT(*) as total_receipts,
        COALESCE(SUM(total), 0) as total_spent,
        COALESCE(AVG(total), 0) as average_total
      FROM receipts
      WHERE user_id = ${userId}
    `;

        return {
            totalReceipts: parseInt(stats.total_receipts) || 0,
            totalSpent: parseFloat(stats.total_spent) || 0,
            averageTotal: parseFloat(stats.average_total) || 0,
        };
    } catch (error) {
        console.error('Failed to get receipt stats:', error);
        throw error;
    }
}
