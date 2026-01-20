/**
 * Database Utility for Neon PostgreSQL
 * 
 * Provides functions to interact with the Neon database for storing
 * and retrieving receipt data.
 */

import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config/database';
import { Receipt, ReceiptItem } from '../types';

// Create Neon SQL client
const sql = neon(DATABASE_URL);

/**
 * Initialize the database schema
 * Creates tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
    try {
        // Create receipts table
        await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        scan_date DATE DEFAULT CURRENT_DATE,
        store_name VARCHAR(255),
        subtotal DECIMAL(10, 2),
        tax DECIMAL(10, 2),
        total DECIMAL(10, 2),
        raw_text TEXT
      )
    `;

        // Create receipt_items table
        await sql`
      CREATE TABLE IF NOT EXISTS receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER DEFAULT 1
      )
    `;

        // Create indexes
        await sql`
      CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id 
      ON receipt_items(receipt_id)
    `;

        await sql`
      CREATE INDEX IF NOT EXISTS idx_receipts_scan_date 
      ON receipts(scan_date)
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
 * @returns The saved receipt with its ID
 */
export async function saveReceipt(receipt: Omit<Receipt, 'id'>): Promise<Receipt> {
    try {
        // Insert the receipt
        const [insertedReceipt] = await sql`
      INSERT INTO receipts (store_name, subtotal, tax, total, raw_text)
      VALUES (${receipt.storeName || null}, ${receipt.subtotal || null}, ${receipt.tax || null}, ${receipt.total || null}, ${receipt.rawText || null})
      RETURNING id, created_at, scan_date, store_name, subtotal, tax, total, raw_text
    `;

        const receiptId = insertedReceipt.id;

        // Insert items if present
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
 * Get all receipts (without items for list view)
 * @returns Array of receipts ordered by date descending
 */
export async function getAllReceipts(): Promise<Receipt[]> {
    try {
        const receipts = await sql`
      SELECT id, scan_date, store_name, subtotal, tax, total
      FROM receipts
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
 * @returns The receipt with items, or null if not found
 */
export async function getReceiptById(receiptId: number): Promise<Receipt | null> {
    try {
        // Get the receipt
        const [receipt] = await sql`
      SELECT id, scan_date, store_name, subtotal, tax, total, raw_text
      FROM receipts
      WHERE id = ${receiptId}
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
 */
export async function deleteReceipt(receiptId: number): Promise<void> {
    try {
        // Items will be deleted automatically due to CASCADE
        await sql`
      DELETE FROM receipts
      WHERE id = ${receiptId}
    `;
    } catch (error) {
        console.error('Failed to delete receipt:', error);
        throw error;
    }
}

/**
 * Get receipt statistics
 * @returns Statistics about stored receipts
 */
export async function getReceiptStats(): Promise<{
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
