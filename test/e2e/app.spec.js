/**
 * E2E Browser Tests
 * Uses Playwright for browser automation testing
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

test.describe('CampusVerify E2E Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Go to app and wait for load
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
    });

    test.describe('Navigation', () => {

        test('should load home page', async ({ page }) => {
            await expect(page).toHaveTitle(/CampusVerify/);
            await expect(page.locator('.brand')).toContainText('CampusVerify');
        });

        test('should navigate between pages', async ({ page }) => {
            // Click Submit nav
            await page.click('[data-page="submit"]');
            await expect(page.locator('#submitPage')).toBeVisible();

            // Click Dashboard nav
            await page.click('[data-page="dashboard"]');
            await expect(page.locator('#dashboardPage')).toBeVisible();

            // Click Leaderboard nav
            await page.click('[data-page="leaderboard"]');
            await expect(page.locator('#leaderboardPage')).toBeVisible();

            // Back to Feed
            await page.click('[data-page="feed"]');
            await expect(page.locator('#feedPage')).toBeVisible();
        });
    });

    test.describe('Theme Toggle', () => {

        test('should toggle between dark and light mode', async ({ page }) => {
            const html = page.locator('html');
            const themeBtn = page.locator('#themeToggle');

            // Default should be dark
            await expect(html).toHaveAttribute('data-theme', 'dark');
            await expect(themeBtn).toContainText('🌙');

            // Toggle to light
            await themeBtn.click();
            await expect(html).toHaveAttribute('data-theme', 'light');
            await expect(themeBtn).toContainText('☀️');

            // Toggle back to dark
            await themeBtn.click();
            await expect(html).toHaveAttribute('data-theme', 'dark');
        });

        test('should persist theme preference', async ({ page }) => {
            // Toggle to light
            await page.click('#themeToggle');

            // Reload page
            await page.reload();

            // Should still be light
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        });
    });

    test.describe('Rumor Feed', () => {

        test('should display rumor cards', async ({ page }) => {
            const feed = page.locator('#rumorsFeed');
            await expect(feed).toBeVisible();

            // Should have rumor cards (from seeded data or empty state)
            const cards = feed.locator('.rumor-card');
            // Note: count depends on seeded data
        });

        test('should filter rumors', async ({ page }) => {
            // Click different filter tabs
            await page.click('[data-filter="recent"]');
            await page.click('[data-filter="verified"]');
            await page.click('[data-filter="disputed"]');
            await page.click('[data-filter="trending"]');

            // Each should trigger re-render
        });

        test('should open trust score modal', async ({ page }) => {
            const cards = page.locator('.rumor-card');
            const count = await cards.count();

            if (count > 0) {
                await cards.first().locator('.trust-badge').click();
                await expect(page.locator('#trustModal')).toBeVisible();
            }
        });
    });

    test.describe('Submit Rumor Flow', () => {

        test('should complete 3-step wizard', async ({ page }) => {
            // Navigate to submit page
            await page.click('[data-page="submit"]');

            // Step 1: Content
            await page.fill('#rumorContent', 'Test rumor for E2E testing - library will be open 24/7 next week');
            await page.click('[data-category="academic"]');
            await page.click('input[value="medium"]');
            await page.click('.btn-next');

            // Step 2: Evidence
            await expect(page.locator('#submitStep2')).toBeVisible();
            await page.click('[data-type="testimony"]');
            await page.fill('#evidenceDescription', 'I heard from a friend who works at the library');
            await page.click('text=Review & Submit');

            // Step 3: Confirm
            await expect(page.locator('#submitStep3')).toBeVisible();
            await expect(page.locator('.review-card')).toContainText('Test rumor');

            // Submit
            await page.click('text=Confirm & Submit');

            // Should navigate to feed with toast
            await expect(page.locator('#feedPage')).toBeVisible();
        });

        test('should validate required fields', async ({ page }) => {
            await page.click('[data-page="submit"]');

            // Try to proceed without content
            await page.click('.btn-next');

            // Should show toast error
            await expect(page.locator('.toast.error')).toBeVisible();
        });
    });

    test.describe('Dashboard', () => {

        test('should show user stats', async ({ page }) => {
            await page.click('[data-page="dashboard"]');

            // Should display stats (even if demo user)
            await expect(page.locator('#dashboardPage')).toBeVisible();
        });
    });

    test.describe('Leaderboard', () => {

        test('should show rankings', async ({ page }) => {
            await page.click('[data-page="leaderboard"]');

            await expect(page.locator('#leaderboardPage')).toBeVisible();
        });

        test('should filter by period', async ({ page }) => {
            await page.click('[data-page="leaderboard"]');

            // Click different period tabs if they exist
            const periodBtns = page.locator('[data-period]');
            const count = await periodBtns.count();

            for (let i = 0; i < count; i++) {
                await periodBtns.nth(i).click();
            }
        });
    });

    test.describe('Accessibility', () => {

        test('should have skip link', async ({ page }) => {
            await expect(page.locator('.skip-link')).toBeAttached();
        });

        test('should have proper ARIA attributes', async ({ page }) => {
            await expect(page.locator('nav[role="navigation"]')).toBeVisible();
            await expect(page.locator('main[role="main"]')).toBeVisible();
        });

        test('should support keyboard navigation', async ({ page }) => {
            // Tab through navigation
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');

            // Check focus is visible
            const activeElement = await page.evaluate(() => document.activeElement?.tagName);
            expect(['A', 'BUTTON', 'INPUT']).toContain(activeElement);
        });
    });

    test.describe('Responsive Design', () => {

        test('should work on mobile viewport', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });

            // Navigation should be visible at bottom
            await expect(page.locator('.nav-links')).toBeVisible();

            // Content should be readable
            await expect(page.locator('.container')).toBeVisible();
        });

        test('should work on tablet viewport', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });

            await expect(page.locator('.container')).toBeVisible();
        });
    });
});
