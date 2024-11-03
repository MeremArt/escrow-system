import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

describe("escrow", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Escrow as Program<Escrow>;
  const provider = program.provider as anchor.AnchorProvider;

  // Get keypair from provider wallet
  const makerKP = (provider.wallet as anchor.Wallet).payer;
  const maker = provider.wallet;

  // We'll store these for use across tests
  let mintA: web3.PublicKey;
  let mintB: web3.PublicKey;
  let makerAtaA: web3.PublicKey;
  let makerAtaB: web3.PublicKey;
  let escrow: web3.PublicKey;
  let vault: web3.PublicKey;

  const seed = new BN(123);
  const deposit = new BN(1000);
  const receive = new BN(500);

  before(async () => {
    // Create two test tokens
    mintA = await createMint(
      provider.connection,
      makerKP,
      maker.publicKey,
      null,
      6
    );

    mintB = await createMint(
      provider.connection,
      makerKP,
      maker.publicKey,
      null,
      6
    );

    // Create associated token accounts for maker
    makerAtaA = await createAssociatedTokenAccount(
      provider.connection,
      makerKP,
      mintA,
      maker.publicKey
    );

    makerAtaB = await createAssociatedTokenAccount(
      provider.connection,
      makerKP,
      mintB,
      maker.publicKey
    );

    // Mint some tokens to maker's Token A account
    await mintTo(
      provider.connection,
      makerKP,
      mintA,
      makerAtaA,
      maker.publicKey,
      1000000 // 1000 tokens with 6 decimals
    );

    // Derive PDAs
    [escrow] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    vault = await anchor.utils.token.associatedAddress({
      mint: mintA,
      owner: escrow,
    });
  });

  it("Initializes escrow and deposits tokens", async () => {
    try {
      const tx = await program.methods
        .make(seed, deposit, receive)
        .accounts({
          maker: maker.publicKey,
          mintA,
          mintB,
          makerAtaA,
          escrow,
          vault,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Transaction signature:", tx);

      // Verify escrow account data
      const escrowAccount = await program.account.escrow.fetch(escrow);
      assert.isTrue(
        escrowAccount.maker.equals(maker.publicKey),
        "Maker doesn't match"
      );
      assert.isTrue(escrowAccount.mintA.equals(mintA), "Mint A doesn't match");
      assert.isTrue(escrowAccount.mintB.equals(mintB), "Mint B doesn't match");
      assert.isTrue(escrowAccount.seed.eq(seed), "Seed doesn't match");
      assert.isTrue(
        escrowAccount.receive.eq(receive),
        "Receive amount doesn't match"
      );

      // Verify token balances
      const vaultBalance = await provider.connection.getTokenAccountBalance(
        vault
      );
      assert.equal(
        vaultBalance.value.uiAmount,
        deposit.toNumber() / Math.pow(10, 6),
        "Vault balance doesn't match deposit amount"
      );
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });

  // Optional: Clean up after tests
  after(async () => {
    // Add cleanup code if needed
    console.log("Tests completed");
  });
});
