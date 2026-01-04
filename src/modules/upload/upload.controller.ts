import { Request, Response } from "express";
import { UploadService } from "./upload.service";

export class UploadController {
  service: UploadService;

  constructor() {
    this.service = new UploadService();
  }

  getSignature = async (req: Request, res: Response) => {
    const folder = String(req.body?.folder || "event-platform");
    const result = await this.service.getSignature(folder);
    return res.status(200).send(result);
  };
}
