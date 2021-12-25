import path from 'path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { CsvFile } from './csv-file';

dotenv.config();

const csvFile = new CsvFile({
    path: path.resolve(__dirname, process.env.INSTAGRAM_ACCOUNT_TARGET! + '_followers-data.csv'),
    // headers to write
    headers: ['username', 'fullname', 'biography', 'website'],
});

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
    });
    const [page] = await browser.pages();
    const page2 = await browser.newPage();

    // create event

    await page.waitForTimeout(1000);
    await page.bringToFront();

    // Login Instagram
    console.log('Login Instagram...');
    await page.goto('https://www.instagram.com/');
    await page.waitForSelector('button[type="submit"]');
    await page.type('input[name="username"]', process.env.INSTAGRAM_USERNAME!);
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 10000 });

    // Go to Account
    console.log('Go to Account: @' + process.env.INSTAGRAM_ACCOUNT_TARGET!);
    await page.goto('https://www.instagram.com/' + process.env.INSTAGRAM_ACCOUNT_TARGET!);

    // Get list followers
    console.log('Get list followers...');
    const element = await page.waitForSelector('a[href="/' + process.env.INSTAGRAM_ACCOUNT_TARGET! + '/followers/"]');
    await element?.click();
    const lastItemFollowerSelector = 'div[role="dialog"] ul li:last-child';
    await page.waitForSelector(lastItemFollowerSelector);
    await page.waitForTimeout(3000);

    await csvFile.create([{ username: null, fullname: null, biography: null, website: null }]);
    await getFollowersData(page, page2)

    await browser.close();
})()

/**
 * Loop followers and get data
 * @param page - puppeteer page
 */
async function getFollowersData(page: puppeteer.Page, page2: puppeteer.Page, lastIndex = 0) {
    const followers = await page.$$('div[role="dialog"] ul li');

    for (let i = lastIndex; i < followers.length; i++) {
        const href = await page.evaluate((el) => el.querySelector('a.notranslate').href, followers[i]);
        await page2.goto(href);
        await page2.waitForSelector('h1')
        await page2.waitForTimeout(1000);

        const data = await page2.evaluate(() => {
            const username = document.querySelector('h2')?.textContent;
            const fullname = document.querySelector('h1')?.textContent;
            const biography = document.querySelector('header > section > div:last-child > span')?.textContent;
            const website = document.querySelector('a[page_id="profilePage"]')?.textContent;

            return {
                username,
                fullname,
                biography,
                website
            }
        });

        console.log(`getFollowersData: ${i + 1}. ${data.fullname}`);
        if (i == 0) {
            await csvFile.create([{ ...data }]);
        } else {
            await csvFile.append([{ ...data }]);
        }
    }

    await scrollToBottom(page, page2, followers.length);
}

/**
 * Scroll to bottom of followers list
 * @param page - puppeteer page
 */
async function scrollToBottom(page: puppeteer.Page, page2: puppeteer.Page, lastIndex = 0) {
    console.log('scrollToBottom...');
    await page.evaluate(() =>
        document.querySelector('div[role="dialog"] ul li:last-child')?.scrollIntoView()
    );
    const loading = await page.waitForSelector('div[role="dialog"] svg[aria-label="Loading..."]');
    if (loading) {
        await page.waitForTimeout(3000);
        await getFollowersData(page, page2, lastIndex);
    }
}
