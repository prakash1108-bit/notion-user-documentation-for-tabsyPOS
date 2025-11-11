import { navigation } from '@/lib/navigation';

export async function GET() {
  try {
    return new Response(JSON.stringify(navigation), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to load navigation' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}