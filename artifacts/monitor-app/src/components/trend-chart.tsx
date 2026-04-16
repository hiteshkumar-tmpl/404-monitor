import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TrendsResponse } from "@workspace/api-client-react";

interface TrendChartProps {
  data: TrendsResponse | undefined;
  isLoading: boolean;
  title?: string;
  description?: string;
}

const DAYS_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
] as const;

function formatDate(dateStr: string, days: number): string {
  try {
    const date = parseISO(dateStr);
    if (days <= 7) {
      return format(date, "EEE");
    }
    return format(date, "MMM d");
  } catch {
    return dateStr;
  }
}

export function TrendChart({
  data,
  isLoading,
  title = "Trends",
  description,
}: TrendChartProps) {
  const chartData =
    data?.overallTrend.map((item) => ({
      date: item.date,
      broken: item.totalBroken,
      serverError: item.totalServerErrors ?? 0,
      formattedDate: formatDate(item.date ?? "", data.days),
    })) ?? [];

  const chartConfig: ChartConfig = {
    broken: {
      label: "Tracked Issues",
      color: "hsl(var(--destructive))",
    },
    serverError: {
      label: "5xx URLs",
      color: "hsl(32 95% 44%)",
    },
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-base">{title}</CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground font-mono text-sm">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-mono text-base">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelKey="formattedDate"
                  nameKey="broken"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="broken"
              stroke="var(--color-broken)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="serverError"
              stroke="var(--color-serverError)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface WebsiteTrendChartProps {
  data:
    | {
        websiteId: number;
        websiteName: string;
        days: number;
        history: Array<{
          checkedAt: string;
          totalUrls: number;
          brokenUrls: number;
          trackedIssueUrls?: number;
          notFoundUrls?: number;
          serverErrorUrls?: number;
        }>;
      }
    | undefined;
  isLoading: boolean;
  title?: string;
}

export function WebsiteTrendChart({
  data,
  isLoading,
  title = "URL Health History",
}: WebsiteTrendChartProps) {
  const chartData =
    data?.history.map((item) => ({
      date: item.checkedAt,
      broken: item.trackedIssueUrls ?? item.brokenUrls,
      serverError: item.serverErrorUrls ?? 0,
      total: item.totalUrls,
      formattedDate: formatDate(item.checkedAt, data.days),
    })) ?? [];

  const chartConfig: ChartConfig = {
    broken: {
      label: "Tracked Issues",
      color: "hsl(var(--destructive))",
    },
    serverError: {
      label: "5xx URLs",
      color: "hsl(32 95% 44%)",
    },
    total: {
      label: "Total URLs",
      color: "hsl(var(--primary))",
    },
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground font-mono text-sm">
            No history available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent indicator="dot" labelKey="formattedDate" />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="broken"
              stroke="var(--color-broken)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              name="Tracked Issues"
            />
            <Line
              type="monotone"
              dataKey="serverError"
              stroke="var(--color-serverError)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              name="5xx URLs"
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              name="Total URLs"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface MiniSparklineProps {
  data: Array<{ date: string; broken: number }>;
  width?: number;
  height?: number;
}

export function MiniSparkline({
  data,
  width = 80,
  height = 30,
}: MiniSparklineProps) {
  const chartConfig: ChartConfig = {
    broken: {
      label: "",
      color: "hsl(var(--destructive))",
    },
  };

  if (data.length === 0) {
    return <div style={{ width, height }} />;
  }

  return (
    <div style={{ width, height }}>
      <ChartContainer config={chartConfig} className="w-full h-full">
        <LineChart
          data={data}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <Line
            type="monotone"
            dataKey="broken"
            stroke="var(--color-broken)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
