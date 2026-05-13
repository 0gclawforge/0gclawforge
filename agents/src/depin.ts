export interface WeatherXMNetworkStats {
  net_health: {
    network_avg_qod: number;
    network_uptime: number;
    high_quality_stations: number;
    active_stations: number;
  };
  net_growth: {
    network_size: number;
    last_30days: number;
  };
  last_updated: string;
}

export interface WeatherXMSearchResult {
  id?: string;
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  cell_index?: string;
  type?: string;
}

export interface WeatherXMCell {
  index: string;
  device_count: number;
  active_device_count: number;
  avg_data_quality: number | null;
  capacity: number;
  center: {
    lat: number;
    lon: number;
  };
}

export class WeatherXMClient {
  constructor(private readonly baseUrl = process.env.WEATHERXM_API_BASE || "https://api.weatherxm.com") {}

  async fetchNetworkStats(): Promise<WeatherXMNetworkStats> {
    return this.getJson<WeatherXMNetworkStats>("/api/v1/network/stats");
  }

  async searchStations(query: string): Promise<WeatherXMSearchResult[]> {
    const url = `/api/v1/network/search?query=${encodeURIComponent(query)}&type=stations`;
    return this.getJson<WeatherXMSearchResult[]>(url);
  }

  async fetchCells(limit = 12): Promise<WeatherXMCell[]> {
    return this.getJson<WeatherXMCell[]>(`/api/v1/cells?limit=${limit}`);
  }

  async summarize(query: string): Promise<string> {
    const [stats, cells, stations] = await Promise.all([
      this.fetchNetworkStats(),
      this.fetchCells(3),
      this.searchStations(query).catch(() => []),
    ]);

    const station = stations[0];
    const topCell = cells[0];
    return [
      `WeatherXM network size: ${stats.net_growth.network_size}`,
      `Active stations: ${stats.net_health.active_stations}`,
      `High quality stations: ${stats.net_health.high_quality_stations}`,
      `Average QOD: ${stats.net_health.network_avg_qod}`,
      topCell
        ? `Top live cell: ${topCell.index} with ${topCell.active_device_count}/${topCell.device_count} active devices and avg quality ${topCell.avg_data_quality ?? "n/a"}`
        : "No live cell snapshot available.",
      station
        ? `Top station match for "${query}": ${station.name || "unknown"} at ${station.address || "unknown location"}`
        : `No direct station match found for "${query}"`,
    ].join("\n");
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`WeatherXM request failed (${response.status}) for ${path}`);
    }

    return (await response.json()) as T;
  }
}
