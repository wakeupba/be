export interface PlaceCallInput {
  to: string;
  from: string;
  answerUrl: string;
  hangupUrl: string;
  ringTimeoutSeconds: number;
}

export interface PlacedCall {
  providerCallId: string;
}

/**
 * Carrier abstraction. Everything above this interface is provider-agnostic;
 * swapping Plivo for Telnyx or Exotel means adding one implementation.
 */
export interface TelephonyProvider {
  readonly name: string;
  placeCall(input: PlaceCallInput): Promise<PlacedCall>;
  verifyWebhook(request: Request): Promise<boolean>;
}
