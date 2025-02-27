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
🔹  On Sharding , the information of shorturl is lost as I don't know which shard contains that shortUrl
- to handle that Cache Hit & Cache Miss is implemented

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



