/**
 * Database Utility for Neon PostgreSQL
 * 
 * Provides functions to interact with the Neon database for storing
 * and retrieving receipt data.
 */

import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config/database';
import { Receipt, ReceiptItem, ParsedReceipt } from '../types';

// Create Neon SQL client
const sql = neon(DATABASE_URL);

/**
 * Initialize the database schema
 * Creates tables if they don't exist
 */
/**
 * Initialize the database schema
 * Creates tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
    try {
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
        // Ensure user_id and json_data exist before indexing
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
 * Save a receipt and its items to the database
 * @param receipt - The parsed receipt data
 * @param userId - The Clerk User ID
 * @returns The saved receipt with its ID
 */
export async function saveReceipt(receipt: ParsedReceipt, userId: string): Promise<Receipt> {
    try {
        // Construct standard Core fields
        const storeName = receipt.storeName || null;
        const total = receipt.total || null;
        const scanDate = receipt.date || null; // Will fallback to DB default if null

        // Prepare Metadata Bag
        const metadata = {
            // Add any extra fields here in the future
        };

        // Construct the full JSON object to store
        // Core + Metadata + Raw
        const jsonData = {
            ...receipt, // Includes items, rawText, etc.
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

        // Insert items if present (for relational queries)
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
 * Get all receipts for a specific user (without items for list view)
 * @param userId - The Clerk User ID
 * @returns Array of receipts ordered by date descending
 */
export async function getAllReceipts(userId: string): Promise<Receipt[]> {
    try {
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
 * Get a single receipt with all its items
 * @param receiptId - The receipt ID
 * @param userId - The Clerk User ID (for security verification)
 * @returns The receipt with items, or null if not found/unauthorized
 */
export async function getReceiptById(receiptId: number, userId: string): Promise<Receipt | null> {
    try {
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
 * Delete a receipt and all its items
 * @param receiptId - The receipt ID to delete
 * @param userId - The Clerk User ID (for security)
 */
export async function deleteReceipt(receiptId: number, userId: string): Promise<void> {
    try {
        // Items will be deleted automatically due to CASCADE
        // Only delete if it matches the user_id
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
 * Get receipt statistics for a user
 * @param userId - The Clerk User ID
 * @returns Statistics about stored receipts
 */
export async function getReceiptStats(userId: string): Promise<{
    totalReceipts: number;
    totalSpent: number;
    averageTotal: number;
}> {
    try {
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
