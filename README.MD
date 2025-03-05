# Database Concepts:

| Feature                | **Indexing 📖**                                               | **Partitioning 🧩**                                                       | **Sharding 🏗️**                                                 | **Replication 📄**                                      |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| **Definition**         | Creates a data structure to speed up searches                 | Splits a table into smaller pieces for performance                        | Distributes data across multiple databases                      | Copies the same data across multiple databases          |
| **Purpose**            | **Faster query performance** (especially `SELECT` queries)    | **Optimize storage & query speed** by keeping data organized              | **Handle large-scale data** and distribute load                 | **Ensure availability & redundancy**                    |
| **How It Works**       | Uses **B-Trees, Hashes, or GIN indexes** to find data quickly | Divides a large table **horizontally (rows)** or **vertically (columns)** | Each shard stores a **subset** of data                          | Each replica holds a **full copy** of data              |
| **Scaling Type**       | **Optimizes existing DB**                                     | **Vertical Scaling** (Better query performance)                           | **Horizontal Scaling** (Multiple DBs with distributed data)     | **Read Scaling** (More replicas for load balancing)     |
| **Data Distribution**  | All data is stored in one place but indexed                   | Data is **split logically** but remains in one DB                         | Data is **split across multiple databases**                     | Same data is **copied to multiple databases**           |
| **Query Optimization** | **Speeds up lookups (`WHERE`, `ORDER BY`)**                   | Queries target specific partitions, reducing scan time                    | Queries need a **router** to locate the right shard             | Reads can be distributed across replicas                |
| **Write Performance**  | No impact on writes, but speeds up reads                      | Write performance depends on partitioning strategy                        | Complex writes across multiple shards                           | Writes affect all replicas, can cause lag               |
| **Read Performance**   | **Much faster** due to efficient lookups                      | Improved since queries scan smaller partitions                            | Good, but may require **cross-shard queries**                   | Very fast, since reads can happen from replicas         |
| **Use Cases**          | Speed up searches in **large datasets**                       | Large tables like **logs, transactions, user data**                       | **Massive-scale applications** (e.g., social media, e-commerce) | **Backup, failover, and read-heavy apps**               |
| **Example**            | Indexing `shortUrl` in a URL Shortener for quick lookups      | Partitioning a **logs table** by month                                    | Sharding a **user database** by region (Asia, Europe, USA)      | Replicating a **product catalog** for high availability |

# 🌳 Understanding B-Tree Indexing in PostgreSQL

B-Tree (Balanced Tree) indexing is the default indexing method used in PostgreSQL because of its efficiency in searching, inserting, updating, and deleting records.

## 📌 How Does B-Tree Indexing Work?

A B-Tree (Balanced Tree) is a self-balancing search tree where:

- Data is stored in sorted order (like a binary search tree).
- Each node can have multiple children (unlike a binary search tree which has only two).
- Searching, inserting, and deleting take **O(log N)** time, which is much faster than scanning the whole table (**O(N)**).

### 🔹 Structure of a B-Tree:

- **Root Node**: The top-level node, containing key values.
- **Internal Nodes**: Contain key values and pointers to child nodes.
- **Leaf Nodes**: Store actual data pointers and are linked for fast range queries.

---

## 📈 How B-Tree Indexing Helps Performance?

### 🔹 1. Speeds Up Lookups (`WHERE` Queries)

#### 🔍 Without an Index (Full Table Scan - `O(N)`)

#### 🔍 With an Index (Full Table Scan - `O(logN)`)

```sql
🔥 Summary
✅ O(log N) Search Complexity - Much faster than O(N) full table scans.
✅ Efficient Sorting - Speeds up ORDER BY queries.
✅ Fast Range Queries - Quickly finds values within a range.
✅ Automatic in Primary Keys - No need to manually index primary keys.

```

# 🚀 Partitioning

```
✅ If your queries mostly fetch recent URLs, use createdAt partitioning (Range Partitioning).
✅ If you need multi-user performance, partition by userId (List Partitioning).
✅ If URLs are randomly accessed, use Hash Partitioning on shortUrl for balanced reads.

🔹  Hash Partitioning for the best load transfer.
I did manual partioning as neon db does not do that on its own
```

# 🚀 Sharding

```
✅ I sharded the database based on regions and created global ids using snowflake id (64 bits, time based unique )rather than UUIDS (124 bits very slow).
```

🔹 On Sharding , the information of shorturl is lost as I don't know which shard contains that shortUrl

- to handle that Cache Hit & Cache Miss is implemented

---

### ⚡ Cache Hit & Cache Miss

Cache Hit: When the requested data is found in Redis, meaning it's fetched quickly without querying the database. 🚀
<br>

Cache Miss: When the requested data is not found in Redis, so the system queries PostgreSQL, retrieves the data, and then stores it in Redis for future fast access.
<br>
Using this cache-first approach improves performance by reducing database queries and serving frequently accessed data instantly. 🔥
<br>

<b>🚀(Redis + PostgreSQL)</b> <br>
Used Redis as a cache for quick lookup. <br>
Used PostgreSQL as a backup for durability as redis is volatile. <br>
✅ How it Works <br>

- On Write (Short URL Creation) : Insert shortUrl → shardIndex into PostgreSQL.
  Also insert the same mapping into Redis (cache).
- On Read (Fetching Long URL) : First, check Redis.
  If found → Directly get the shardIndex from Redis.
  If not found → Query PostgreSQL, then store the result in Redis.

---

<br>

# 🚀 Rate Limiting Strategy

## Overview

Rate limiting is implemented to prevent abuse and ensure fair usage of the URL shortener service.

- **Unauthenticated users**: Allowed **2 URL creations per day**.
- **Authenticated users**: Allowed **10 URL creations per hour**.

## Rate Limiting Strategies & Trade-offs

### 1. Token Bucket Algorithm (Implemented)

**How it works:**

- Each user has a "bucket" of tokens.
- Authenticated users receive **10 tokens per hour**; unauthenticated users receive **2 tokens per day**.
- Each URL generation request consumes **1 token**.
- Tokens are refilled at a fixed rate (hourly/daily based on user type).
- Tried LRU to evict older keys but free plan does not support it

**Pros:**
✅ Handles burst traffic efficiently.
✅ More flexible than fixed window limits.
✅ Easy to implement with Redis.

**Cons:**
❌ Users may experience delays when tokens run out.

---

### 2. Fixed Window Counter

**How it works:**

- A simple counter per user is stored in Redis with an expiry time.
- **Authenticated users**: Counter resets every hour.
- **Unauthenticated users**: Counter resets every day.
- If the count exceeds the limit, further requests are rejected until the reset.

**Pros:**
✅ Easy to implement using Redis `INCR` and TTL.
✅ Efficient for handling normal traffic.

**Cons:**
❌ Can cause **traffic spikes** at reset times (e.g., all users get reset simultaneously).
❌ Not smooth for high-load scenarios.

---

### 3. Sliding Window Log

**How it works:**

- Stores **timestamps** of requests per user in Redis.
- At each request, old timestamps outside the window are removed.
- If the count of requests within the time window exceeds the limit, the request is rejected.

**Pros:**
✅ Provides **smooth and accurate** rate limiting.
✅ Avoids sudden traffic spikes at reset times.

**Cons:**
❌ **Memory-intensive** (stores all request timestamps).
❌ Higher **read/write overhead** in Redis.

---

### 4. Sliding Window Counter (Hybrid Approach)

**How it works:**

- Uses a **rolling counter** that gradually decreases instead of resetting completely.
- Smoothly averages requests over time to prevent sudden bursts.

**Pros:**
✅ **Balances accuracy and efficiency**.
✅ Reduces sudden bursts while being fair.

**Cons:**
❌ More complex than a fixed window counter.

<br>

# 🚀 Real-Time Analytics with Kafka & ClickHous

e

## 🔹 Architecture Overview

- 1️⃣ **User clicks a short URL** → Backend publishes an event to **Kafka (`url_clicks` topic)**.
- 2️⃣ **Kafka stores the event** → ClickHouse consumes it for **real-time analytics**.
- 3️⃣ **User deletes a short URL** → Backend publishes a **deletion event (`url_deletes` topic)**, and ClickHouse removes associated records.

## <span>Kafka is used for realtime data streaming like getting instant notifications for every purchases</span>

## 🔥 Why Kafka + ClickHouse? (Locally)

✅ **Scales to billions of events** without PostgreSQL bottlenecks.  
✅ **Decouples analytics from your main database** for better performance.  
✅ **Real-time analytics & deletion handling** with minimal latency.

- `cmd.exe /c "c:\kafka\bin\windows\kafka-server-start.bat c:\kafka\config\server.properties"`
- `cmd.exe /c "c:\kafka\bin\windows\zookeeper-server-start.bat c:\kafka\config\zookeeper.properties"`

---
