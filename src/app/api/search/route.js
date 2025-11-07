import { search } from '../../../markdoc/search.mjs'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!query) {
    return Response.json([])
  }

  const results = search(query)
  return Response.json(results.slice(0, limit))
}