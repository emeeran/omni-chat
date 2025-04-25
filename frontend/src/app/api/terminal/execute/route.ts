import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { command } = data;

        if (!command) {
            return NextResponse.json(
                { error: 'Command is required' },
                { status: 400 }
            );
        }

        // Execute the command
        const { stdout, stderr } = await execPromise(command);

        // Combine stdout and stderr for the output
        const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');

        return NextResponse.json({
            success: true,
            output
        });
    } catch (error) {
        console.error('Error executing command:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                output: error instanceof Error && 'stderr' in error ? error.stderr : undefined
            },
            { status: 500 }
        );
    }
}