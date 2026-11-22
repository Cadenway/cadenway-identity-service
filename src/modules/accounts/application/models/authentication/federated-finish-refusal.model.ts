/** A continuation cannot be redeemed under the current account authority. */
export class FederatedFinishRefusal extends Error {
  // #region Constructor
  /** Does not disclose which part of a continuation was refused. */
  public constructor() {
    super('Federated sign-in refused.');
    this.name = 'FederatedFinishRefusal';
  }
  // #endregion
}
