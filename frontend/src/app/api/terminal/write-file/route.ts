import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Directory to store temporary script files
const TEMP_DIR = path.join(process.cwd(), 'temp_scripts');

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { filename, content } = data;

        if (!filename || !content) {
            return NextResponse.json(
                { error: 'Filename and content are required' },
                { status: 400 }
            );
        }

        // Create temp directory if it doesn't exist
        try {
            await mkdir(TEMP_DIR, { recursive: true });
        } catch (error) {
            // Directory already exists or can't be created
            console.error('Error creating directory:', error);
        }

        // Generate a safe filename - only use the basename and add proper extension
        const basename = path.basename(filename);
        const safePath = path.join(TEMP_DIR, basename);

        // Write the file
        await writeFile(safePath, content, 'utf8');

        return NextResponse.json({
            success: true,
            path: safePath,
            filename: basename
        });
    } catch (error) {
        console.error('Error writing file:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}