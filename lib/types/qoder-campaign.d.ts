/**
 * Qoder campaign resource packages, read through the Qoder Global account API.
 *
 * The official Qoder CLI's `getUsageInfo()` returns the plan, add-on and
 * session buckets but not the campaign grants (`dedicatedResourcePackages`).
 * Those grants are only exposed by the account quota endpoint, which requires
 * a Personal Access Token. This module keeps that optional PAT local, exchanges
 * it for a short-lived job token, and returns the campaign packages for the
 * usage card. It never logs the PAT or the job token.
 *
 * @module dsh-qoder-oauth/qoder-campaign
 */
export interface CampaignPackage {
    id?: string;
    name?: string;
    title?: {
        zh?: string;
        en?: string;
    };
    total: number;
    used: number;
    remaining: number;
    percentage: number;
    unit: string;
    expiresAt?: string;
    available?: boolean;
    status?: string;
}
export declare function fetchCampaignPackages(pat: string): Promise<CampaignPackage[]>;
export declare function readCampaignPat(): Promise<string | undefined>;
export declare function hasCampaignPat(): Promise<boolean>;
export declare function saveCampaignPat(pat: string): Promise<void>;
export declare function clearCampaignPat(): Promise<void>;
/** Validate by actually reading the campaign quota, then persist the PAT. */
export declare function validateAndSaveCampaignPat(pat: string): Promise<void>;
/** The campaign packages for the usage card, or undefined when no PAT is set. */
export declare function campaignPackagesForUsage(): Promise<CampaignPackage[] | undefined>;
