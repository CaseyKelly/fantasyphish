"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";

interface Tour {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date | null;
}

interface TourSelectorProps {
  tours: Tour[];
  currentTourId?: string;
}

export function TourSelector({ tours, currentTourId }: TourSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tourId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (tourId) {
      params.set("tourId", tourId);
    } else {
      params.delete("tourId");
    }

    router.push(`/leaderboard?${params.toString()}`);
  };

  return (
    <select
      value={currentTourId || ""}
      onChange={handleChange}
      className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
    >
      <option value="">All Time</option>
      {tours.map((tour) => (
        <option key={tour.id} value={tour.id}>
          {tour.name} ({format(new Date(tour.startDate), "yyyy")})
        </option>
      ))}
    </select>
  );
}
