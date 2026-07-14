import { getStore } from "@netlify/blobs";

// Shared, server-side booking store — every visitor reads/writes the same data,
// so availability is always in sync across all devices/browsers.

export default async (req) => {
  const store = getStore("ungkraft-bookings");
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method === "GET") {
    const list = (await store.get("all", { type: "json" })) || [];
    return new Response(JSON.stringify(list), { headers: cors });
  }

  if (req.method === "POST") {
    let booking;
    try {
      booking = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: cors });
    }

    if (!booking.date || !booking.time || !booking.service || !booking.name || !booking.phone) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: cors });
    }

    const list = (await store.get("all", { type: "json" })) || [];

    // Guard against double-booking the same slot (race condition safety net)
    const alreadyBooked = list.some((b) => b.date === booking.date && b.time === booking.time);
    if (alreadyBooked) {
      return new Response(JSON.stringify({ error: "already_booked" }), { status: 409, headers: cors });
    }

    const saved = {
      id: "UK-" + Math.floor(100000 + Math.random() * 900000),
      date: booking.date,
      time: booking.time,
      service: booking.service,
      name: booking.name,
      phone: booking.phone,
      email: booking.email || "",
      address: booking.address || "",
      customerType: booking.customerType || "Privat",
      price: booking.price || "",
      notes: booking.notes || "",
      createdAt: new Date().toISOString(),
    };

    list.push(saved);
    await store.set("all", JSON.stringify(list));

    return new Response(JSON.stringify(saved), { status: 201, headers: cors });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers: cors });
    }

    const list = (await store.get("all", { type: "json" })) || [];
    const next = list.filter((b) => b.id !== id);
    await store.set("all", JSON.stringify(next));

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  }

  return new Response("Method not allowed", { status: 405, headers: cors });
};

export const config = { path: "/api/bookings" };
