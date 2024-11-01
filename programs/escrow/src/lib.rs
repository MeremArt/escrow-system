use anchor_lang::prelude::*;

mod state;
mod instructions;

use instructions::*;
declare_id!("EKERcp9J8ur8UsCR9AhnNeohafdCLVpqFVAABfuvAo4H");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
