"use client";

import { useParams } from "next/navigation";
import { StockView, STOCK_ZONES } from "../stock-view";

export default function StockZonaPage() {
  const params = useParams<{ zona: string }>();
  const zona = STOCK_ZONES.some(([z]) => z === params?.zona) ? params.zona : "normal";
  return <StockView zona={zona} />;
}