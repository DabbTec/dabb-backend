import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

// When running on serverless platforms (like Vercel) the Postgres server
// requires TLS. Ensure we pass SSL options so connections don't fail with
// certificate validation errors. For local development this will work
// the same as before.
const sql = postgres(connectionString, {
	ssl: {
		rejectUnauthorized: false,
	},
})

export default sql