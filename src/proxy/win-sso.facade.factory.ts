import { injectable } from "inversify";
import { PeerCertificate } from "tls";
import { WinSso } from "win-sso";
import { IWinSsoFacadeFactory } from "./interfaces/i.win-sso.facade.factory.js";
import { IWinSsoFacade } from "./interfaces/i.win-sso.facade.js";

@injectable()
export class WinSsoFacadeFactory implements IWinSsoFacadeFactory {
  create(
    securityPackage: string,
    targetHost: string | undefined,
    peerCert: PeerCertificate | undefined
  ): IWinSsoFacade {
    return new WinSso(securityPackage, targetHost, peerCert);
  }
}
