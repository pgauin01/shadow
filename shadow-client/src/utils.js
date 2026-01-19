export const parseEventDate = (dateStr, timeStr) => {
  if (!timeStr || timeStr === "All Day") return null;

  // Convert "02:30 PM" to 24-hour format
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":");

  if (hours === "12") hours = "00";
  if (modifier === "PM") hours = parseInt(hours, 10) + 12;

  return new Date(`${dateStr}T${hours}:${minutes}:00`);
};

export const getPriorityColor = (p) => {
  if (p === "High") return "border-l-4 border-l-red-500";
  if (p === "Medium") return "border-l-4 border-l-blue-400";
  return "border-l-4 border-l-stone-300";
};
