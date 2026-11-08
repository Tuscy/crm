"use client";

import Link from "next/link";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@stky/crm";
import { Card, CardContent, CardHeader } from "@stky/ui";
import { Button } from "@stky/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@stky/ui";
import { ChevronDown } from "lucide-react";
import { updateDealStage } from "@/lib/server/actions/deals";
import type { Deal, Lead } from "@stky/db";

type DealWithLead = Deal & { lead: Lead };

export function PipelineKanban({ deals }: { deals: DealWithLead[] }) {
  const dealsByStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = deals.filter((d) => d.stage === stage);
      return acc;
    },
    {} as Record<PipelineStage, DealWithLead[]>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => (
        <div
          key={stage}
          className="flex-shrink-0 w-72 rounded-lg border bg-muted/30 p-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {PIPELINE_STAGE_LABELS[stage]}
            </h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {dealsByStage[stage].length}
            </span>
          </div>
          <div className="space-y-2 min-h-[120px]">
            {dealsByStage[stage].map((deal) => (
              <PipelineCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineCard({ deal }: { deal: DealWithLead }) {
  async function moveToStage(stage: PipelineStage) {
    await updateDealStage(deal.id, stage);
  }

  return (
    <Card className="group">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/leads/${deal.leadId}`}
            className="font-medium text-sm hover:underline leading-tight"
          >
            {deal.lead.name}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PIPELINE_STAGES.filter((s) => s !== deal.stage).map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  onClick={() => moveToStage(stage)}
                >
                  Move to {PIPELINE_STAGE_LABELS[stage]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
        {deal.lead.company && (
          <p className="truncate">{deal.lead.company}</p>
        )}
        {deal.value != null && (
          <p className="font-medium text-foreground mt-1">
            £{deal.value.toLocaleString("en-GB")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
