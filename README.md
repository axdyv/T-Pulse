# 💗 T-Pulse

## 💡 Inspiration

When you think of **T-Mobile**, one word stands out: **connection**.
But connection isn’t just about **signal strength**, it’s about how people **feel** when they’re connected.
We wanted to capture that feeling the nation’s emotional pulse and help visualize how customers truly experience T-Mobile across the U.S.

## ⚡ What It Does

**T-Pulse** is a **real-time emotion analytics dashboard** that visualizes customer sentiment across the U.S. using a live **geo-emotion heatmap**.
It uses an **AI-powered NLP pipeline** to calculate a **Happiness Index (HI)** that reflects emotional “hotspots” across the country.
By continuously processing incoming data, the system:

* Flags **anomalies and surges** in frustration or delight ⚠️
* Helps T-Mobile act before issues escalate 🚀

## 🧠 How We Built It

* **Backend:** FastAPI + Celery Workers + Redis Streams for simulated real-time data ingestion and NLP scoring
* **NLP Layer:** Google Cloud Natural Language API for emotion classification
* **Data Pipeline:**
`JSON → Redis Queue → Enrichment Worker → Aggregation → Live Dashboard`
* **Visualization:** Dynamic heatmap that updates region scores using the Happiness Index
* **Frontend:** Next.js + shadcn/ui for a clean, minimal, brand-consistent interface

## 🚧 Challenges We Ran Into

The hardest challenge was **data generation and realism**.
Since real-time T-Mobile data wasn’t available, we used **Generative AI** to synthesize realistic reviews and simulate live data streams over websockets, maintaining authenticity and scale.

## 🏆 Accomplishments We’re Proud Of

We’re incredibly proud of building a **fully functional real-time pipeline** from data ingestion → AI emotion scoring → **instant visualization**.
This was our **first time building a live stream system**, and seeing it come together on the dashboard was an amazing moment.

## 📚 What We Learned

We learned how to **simulate real-time data streams** using queues and workers, and how to **scale AI inference pipelines** efficiently.
We also learned how to visually communicate emotion not through text, but through **color, motion, and geography**.

## 🚀 What’s Next for T-Pulse

* **Integrate social media APIs** (Twitter, Reddit, etc.) for real data
* Combine **network performance metrics + customer sentiment**
* Add **predictive insights** to alert teams before issues spread
* Expand to other KPIs like **CX score, response time, and outage mapping**
* Utilize the Gemini API and train it on our data to provide actionable insights and more data clarity

💗 **Why T-Pulse**

Just like keeping your finger on the pulse helps you monitor a heartbeat, T-Pulse helps T-Mobile keep its finger on the emotional pulse of its customers. T-Pulse transforms data into awareness, giving T-Mobile a living, breathing view of its customer experience in motion.
