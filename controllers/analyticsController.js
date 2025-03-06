export const getAnalytics = async (req, res) => {
  try {
    const { shortUrlId, startDate, endDate, period } = req.query;
    const whereClause = { shortUrlId };

    // Auto-set startDate and endDate based on period
    const today = new Date();
    if (period === "monthly") {
      const firstDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
      whereClause.date = { [Op.gte]: firstDayOfMonth };
    } else if (period === "yearly") {
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      whereClause.date = { [Op.gte]: firstDayOfYear };
    } else {
      if (startDate && endDate) {
        whereClause.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        whereClause.date = { [Op.gte]: startDate };
      } else if (endDate) {
        whereClause.date = { [Op.lte]: endDate };
      }
    }

    const result = await AggregatedAnalytics.findAll({ where: whereClause });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Database Query Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
