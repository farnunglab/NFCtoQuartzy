{
	"name": "<YOUR PROJECT NAME>",
	"main": "src/worker.js",
	"compatibility_date": "2025-09-20",
	// Non-sensitive defaults can go in vars.
	"vars": {
		"CURRENCY": "USD",
		// Max age for signed URLs in minutes
		"ALLOWED_SKEW_MIN": "1440"
	},
	"kv_namespaces": [
		{
			"binding": "DEDUP",
			"id": "<YOUR DEDUP ID>",
			"preview_id": "<YOUR DEDUP PREVIEW ID>"
		}
	]
}
