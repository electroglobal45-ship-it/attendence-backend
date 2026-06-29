import * as dotenv from 'dotenv';
dotenv.config();

import { ChannelsService } from './modules/messaging/channels.service';

async function main() {
  console.log("--- TESTING GET MEMBERS ---");
  try {
    const service = new ChannelsService();
    const members = await service.getMembers('7fe7dd7e-edea-4890-8a12-e38336d44fc3');
    console.log("Returned members:", members);
  } catch (err) {
    console.error("Error in getMembers:", err);
  }
}

main();
