// ============================================================================
// CONSTANTEN & STANDAARDDATA
// ============================================================================
// Ontworpen kleuren/tokens, huisstijl-instellingen, referentiedata uit de schattingsfiche
// (klassen/ABEX/verdiepingen), de dropdown-/checklistopties, en de standaard (lege) dossier- en
// pandobjecten. Puur data + kleine pure helpers — geen React-componenten, geen Supabase/AI-calls.
// Verplaatst uit App.jsx (zie audit, punt "App.jsx opsplitsen") als eerste, laagste-risico stap.
// ============================================================================
import { createContext } from "react";
import { Sofa, Trees } from "lucide-react";
import { uid } from "./lib/format.js";

// ---------- design tokens ----------
const INK = "#1B1F27";
const INK_SOFT = "#4B5160";
const PAPER = "#F6F4EF";
const PAPER_RAISED = "#FFFFFF";
const LINE = "#DDD8CA";
const BRASS = "#8C6A2F";
const BRASS_SOFT = "#F1E9D6";
const STAMP = "#2F5B4F";
const STAMP_SOFT = "#E4EEEB";
const DANGER = "#9A3B2E";

// ---------- huisstijl (branding) ----------
// Standaard "Houpels Valuation & Real Estate" (brass-kleur, geen logo-afbeelding — enkel tekst,
// zoals nu al overal in het rapport gebeurt). Gebruikers die met een @huyzen.be-e-mailadres
// inloggen krijgen automatisch de "Huyzen Vastgoed"-huisstijl (eigen kleur + logo) op de
// voorpagina en in de kop-/voettekst van het rapport — geen instelling nodig, gebaseerd op het
// e-mailadres van de ingelogde gebruiker (zie kiesHuisstijl hieronder).
const HUYZEN_BLAUW = "#0093D3";
const HUYZEN_LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAABJWlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGAycHRxcmUSYGDIzSspCnJ3UoiIjFJgP8/AxsDMAAaJycUFjgEBPiB2Xn5eKgMqYGRg+HYNRDIwXNYFmcVAGuBKLigqAdJ/gNgoJbU4GWikAZCdXV5SABRnnANkiyRlg9kbQOyikCBnIPsIkM2XDmFfAbGTIOwnIHYR0BNA9heQ+nQwm4kDbA6ELQNil6RWgOxlcM4vqCzKTM8oUTC0tLRUcEzJT0pVCK4sLknNLVbwzEvOLyrIL0osSU0BqoW4DwwEIQpBIaYB1GihSaK/CQJQPEBYnwPB4csodgYhhgDJpUVlUCYjkzFhPsKMORIMDP5LGRhY/iDETHoZGBboMDDwT0WIqRkyMAjoMzDsmwMAwrNP/kOlMAQAAE29SURBVHja7b1ptGXneRb4PO/77XPOnWqeVZNkyZJlS5ZkWZZj4hAnITgDGUiHhKZJdxY00DQ00AtWd+iV5geLNA00dBhWmkVPCwgE6DgjcSBkdmzFmudZKlWpVPN0x3P2/t6nf3x7n3urVCWprLqle2XtZFlyue49Z+/v3e/4vM9DSfjg+uC61pd98Ag+uFbjSl83dyqA7T+BYBiAMFj3R1e8OP4byz8//m8X/f7lfwgsf4Plg7uf1yU/pjf9mg8Ma/0ZlqRytmLjUYnFUARBgEBbPuRA+V+7c3+TOY3tiOosCIBEQCzmJJZfD0Ct/aq1t/GvFcD3pW3x6yLHUutEAkEFI8kAMgMOSMuG0f51tn8IgsXsEFDng9j9ndabEerMcOzbGICk7neQUvkJgFxpru9Th/V15LGocpDMgDE8HIKgYLEdEShvWfExXg49ijeDyNYwiqFRxfwQEMtvZzEjAyGZCFIrI2praJePpB94rHXnrVRcTTlkkQ3gkAUCypTBjLz8SQeQ3+Ra2JU8dmX/qJCWnZqMBBgIa30hQfvAY63/3Kr9J12Eu8AgTIHAKHkNLOQ4Obd4cm7x1NzihVE+t8Bzi83CaDS3tDRfN3WgCTXRSJHMK7e+2WSqpvqDiX5/86RtmMCGHrdNT+6Yntg2PZhKNmFMK2wmQlkI0K3YJfl+f+zvV4+lkjtJCImAmxUXJBOFEegaOav/87FXv/DEsYW6nhvF/CgvjHKWZ7LxJDII0AQDQLEtEAVSFpIERMojUzgw1UuTPZ+ubPPM1P5N0/s22sHNkx/euWn3ZNrY61Vd+hUhCuXr8KLM/wOP9R5fsSIocUWgUveqlLxHRpI0cgE4Nj/MC4u3bN/QJlogRBkfPnr6d48szGzc0AjWo/WNoAMpCCq61J0QBcHHCTohSCQzA7QMO5fzuRCWoPn6gcOvQVFVg6nEHQN8ZNf0zVsHd+/ZftP2me2T/anO+EMSYHyLHoS60sPWV162rgyruAhmQAYCThBRciiGEMoEk7nDBJwOPH/i3MOvnXno2PlHjpy6c7P/Pz/8OcRIlpIAOIGpihP95J6kCAGRMw0yMo+D6IpuQ35Tg6tk5AIyAToBMhGDbRCycF5xbrF59rlZw4UJvrF7Kt26fequGzbec2DbzTs2bjbrAQCaCIhupUAICaBRJTOMrkSwddSZWFeGxVKiVSx+CRQhZkA53MwqpgwczfHEkZNffuXkA0fOvnCmHg57YH+Jg9t2VAEY25w7BAdMERHSpRnBO8kPdBnLb/9DEluDlye3alrACHq11suv5C++fGL6K4c/tNk/uXfrZ27e/rE9W3am5EAIdcAJWAh0kGGQEXBmMIPpA8NaDY9lRDgCMoCiAgq4kRVxVvH4kTO/8eLxLx069fL5xbmo3CfYH1jfZRUWhNxmNG3jigDgtio+gMjlAwQEECGUnpmbpp2oFqP/+JnhwydP/csnjt60sfcN+3d8yy077ti7eZNbwLPoxT6NkAgGDOQ6GsCtL4+FkEGC1QoTLNECeObC4u8+d+w/PX/i8RNz52TqD3qDmYlMgKEm2GQpOMqWMuDjTjgBIHF1LGvFEKhruFswTGFZYRg6faLf02Aoe2y2eezRU//6iWMf3zb5uVu3f/a23bdNT5AYKRiNmzI84OsrHV5P31YBIjLkkcw4Czxw+Mx/fPLIl186cWhJC72ZNLG5D0iIsBGsMRAcNFYxNdFrwvKKzmQABvgqjuGXk3CqzZcomsiAwgHLMmMzcKqaOg/+xpnRl3/j5Z9+4OXP3LTz2+/cd88Nm2ZoUkaQDJHrqE2xngyrEWiWyHOhX3/26M899sZDr8+eo6s/U81wAsxSFjzoaLIhqa3xcxnNBDJAsk2CAADuvjqnxUu6OgSClkkKJlhpvlKuUBc4+z23autLGc89fe5nnz95397NP3DHns/dsnPakQOKkK8by1qzhqWL5r8Sycp5SviVZ177d48eeuyNhSWfqiY2JENWNJEgGDKQG6egJElWZsRhISv9o0tPPvkqeSyu/DcKgILhogXbUSLDECOWZD1EC6QAzHJ/anIB+A+vzX/p1Sc/ccOr33fX3s/desNOMwCh0sf/wLDemQUJyMiEmUhmIRRGmgKljD8LfPG51//Vg4eeOn5hNk2n6R2uHMhZMJkQLJM5GUQrAZGlE2BAmCJQBSAiIAdZEh+WWNiO+qIdMAev6Q2WGaEJJRUvhka0rVeg65ApSoujUZjQH0wNOf1bJxYe+vdP3/HwkT9+7/7Pf3j3DBk5YGYCGKAAByAFibUDsHvvDYsAlIlspGCUQCoYICPcfRH41VeP/4uvvPzY4Qt1qji5uc9eZFAORNt4aFvtAAt4oJsMdugWihGKAIxabrHC/HqeRGtQb/Zs3XS67Ym1I3NBitTvN3177MTC0z//7M8eOPyjn9r/TQd2mdAYKnSgHay57GtNhMJMA+ASogFdsgCTUcBXzyz8sy8992svnV9kvzezVVQtKmRl8CcLU1DvxH4jognRuBJplXxtpi3t8EhUAAGrBpMYVL/1xtJDP/vI99++829868cH3nq/7uvb5fKIr2/DEpjhRMmwBUUye32U//mDL/7rh984udTvD2b69FrIDAqmIBjkO+xkloOKrgtKLLfU2xnimkswCRZkDkwEUwMgMFkNFph+8bnTf+kb692TfUiEFTgOL0GEfeCxIDhGTmuYoFw5hkhffOXkP/31px8+ozw1laZtFMaSRgS8RL1S25Eg+c4eZQB5PCjsnn9aq03HkpmZoAJ8heUC/MruE/2REWBpXFhIBbxBrp2ZzxowLIIyKaBcpXRkcfRPfufxf/PkqZEPqulBDV9iuI8og7zEPZECosA731zbX/ZDSEVEBGAtqA8CuDY9FlrQagHYlAQsghgaTbCGw/KmlISdVmASIXhBFwrveSxcA1WhILmZOe2XXz3zD37txWfOLdjUdLA3UvQUbBRMgfFOggEUCIgSL8ZlvlUmFxGKcmpCm8K7r8XJrqkAqRlkW/1BgJkyYL2MXnFSMFMLmh7VeaJXoYwp10DaeF0Nq308CKLOcFMKIEf03M428Y9/7/l//uDr8zbt01saNVImoLLWIKNJiIKRKuBMtg2uK2Yp4IrOFZmB3K02sENXJSOh6H6i+EITxfcyVdEypFXj/QsxCAqmsmIE74rh7LQvvfDyQ6+d+DPffv8m4zCQTA42krExAKji+rYirqthEWAO0GqrPATJ1HiqHjsz9zd/9anfPrrUn5zuKdcxFL0YTMnQwVhZK32NZi1FB1Me1+fJliHCXF7bWpnfv/cxcTncywAFmdvvGSBL8+2cV3//q4cfna9+7Fs+esfmyVzncDfWIaeMkplwHRNKu74PKVheOlgjk6BUfeHFo3/2X33ld45xMD0D5HmvssEvRj5dmx5SjsjFyy2bl3Mdr+yWfn5mADDDxMym335df+6nH/jCy2+w8kDOQSutV17vYvG6PtYMNEYxInJyzSb+xJdf+qu/8Nzrsbk/1ZOaQOVReTjFa3sA5LLH6pqSAcC5bqZvXV6JAHJnJgyY1CaesejTdigm/urPP/m/PvDCkjm9ahREzozm+t7odQ2FSRFhtdhLOFbH3/zi4z/7/FmfmjEp55zRB2jKlLQKT0HdcuCKFWV48vWIOJfGLqt1uQ2s0YRqWvKlauYffum1oyfm/vrnP74jsWnMDL5y+/F95rECSYFe4lMXRn/+Zx75uWfm+5MzYFMzA2FoAGWzxhjXPndmSFmXFuJOGxvZurzMMh1AAwbNlUIOeG+w5d8+t/AX/t0Dz88NU7KceZ3P+vqGwmhSZb9//Oxf/Ne/97snc2/DdISkihrD75oqGoyHste0zIocBckpjvN1mK3LHGvseNVtXfcoQ2QKsizLzP3pDb95DP/tv/nKgyfPVRWzmveFYQlChhRAVpaaOtTz9Guvn/pzP/vICwv9qYlqqJzpJTyZjKVwQX73iabA0jkQEQVlB2a0OVZXYRqAVPaWYQUJIZCiGFqLxtS27trBe7ud3Xb3emQvjFIwyFwTw2gGg8EzFyb+/L999DePnqks1RGKCEQurfqvvcJ+7wxLiHarIBDBqHNl/LmXT/2lLzzymjam3mST6yDCskkAgxAVRHHsXAFAeDfZ7rg9QSCr3ejpwAQqfSzriBqKyRHU2o2M3UpQW4SMexAFnVqQQjSBMkOyXA966dXY8Jd+9qEvHjpdmSlG7dvFEJq49tX3ahsWESy2hUbyXv/nnjv+P/zCUyd9y4RFg2HjTpHhul7hWOV1xUUJlfv6I3tpN8LexrfRpEzUNupVeINb/vsvPP5LL5+0NBhFALJ2N3u9eaxA6VhBqHvJf+bF4//jrzyxxKlpNNRiNod6HjBdpz1gkqEIXUpHlNbjErIu98jGdCZQAYCEaeQ+IlzDacOFNP1Xf/GJf/vy6Z5XkQUY0ItrnMtel+Q9h42Uk1W/9OLJv/FLT1/obWLPR8LI+oheCsmXstfXrSLLilrRRZD2Q5Otw24DV/YdWiszIzscUTu6Vt1vzKOXZSPVVvFctel//sWnfvWVs1WyUShWk15htQzLMqxp+t77xUPn//ovPjObZhJVi4EBo2+i2DQko2eRVtu2CpwhQnlFKCzTwHVZFK6AwI47U2wNq8CfLTOFyZAhrzmRMRmNVV6ft/5f/4Unv3jkQs+TN8Nq1aqU1XqujcJ7/d85fvbHfvmR02nGeiqkZ1XUriyrAVIVZbxeeEeVXnsXN0qG7lcBFlw77kqK5dlU98cr1zcKIqLKRLaGCpdgzDLv85RN/dgvPP7AyfNWTdSKtWtYAeRuxiAIyrVySvbQufm/9vOPnYqB93Nkmqqw3HiERVAUXJCNwprrdSDWhg1qnKbY2KjXjesq6/u8JL3icpIlQh7hQchNSmpgw8zwPKmmxx6ONf7XvvD4o+cXKvc6AqWEV1lp0VoxLEEZGcoKtF1I8tWFpR//wldfWZjpp0oxCqSMsrPpkFHMNt4aWA13pQ4Y0+0iAwHPXVuB1vWxQKcJCErLOxhr1lkV/Ez7hpDLNJfWGQQRQQsLsAkLwIIMOAWhCXnWqN+rnpvr//jPP3x4aUiizoHC0aNQhy167w3Lgz2lAg3KcNLnsv34rzzx4HlUk5AWgBAj7L0POTlWJiZl/YtGex9w65Fvg1gUcvgibAQC0fSn+l8+k3/8i0/Nwxxek6JMSnKuEcMCI8MED1MtLJn95G8+8euvzqXJGUaWKmGieKn39vAExpszCrNkaDGI63BguExgaW+zgE8Yo6Is5ALVDNPkpv/w4uxP/uZT4RyFahNoQXbot/fasDJZePMix8D5/zx+6P997Hh/cqZXNwxmTDCSFUrO98ywSAhEflOQK9sYbNdi2HFlay1bkqTIMQ7xHanu2zxcwaGeiQZr4AR6zbCamvq/H3r9Xz5xZOCmLAmSmmvhsq6FxxJdxsiVp9964/w/+o1X68GmmqxZ1UxgOIbkKOw9HsAJaOLSRhBJ71KrFVXXOkjgv4Yfyl6LtQeEVFuqjbVFPbn57/+nl7504kLfTTmowhK1FnIsKUs0O7ww+pu/8vg5TSRTIxNSEEBNKdNNYatW3L7DFyCX4nXFqRjNyS5f59r2Vu/S1RXEX9lyakQGEmSV8QQnfuJXnjqyVFvyEeDX4pTsqt/6TjREK1jPRS0af+I3n3rs/ChNpEasFK7GFQAze1Dl8Z6hgNl99xy6pOVjpF1UVQhcu5Y1TgPF5eMY38il53TJSYuek1CFgcgeucrwbE2AE3z4zMLf+83n5gmuHNG3vHG60u+8hh4r1LZ9I5CLUY2UK7N/88RrP/vs6WpqS5MNcpFh6u4oDDkb83VEMJbFQ4ll2g8y6Fnelhsd8sRNNFMYEEGBdVBatQnau3o91CLJKDQrjrncSWWeClDjCuiMIMLCkCkGksiwyMaGhog0uenfPn3i554+0jcfqmU9DeQCpBCwwsJWwbCCRjYeEUompyIDffNHT8/+5O8874PJiRE9EFbr0m+hNfCys9EKdEPLpWF20VPgOuDHlhTxLt64izswDEY1OVIeTP7933rmiTMXBuYhuUJwoaKCqmPcXl4Nw8pAiFAQYLCBAXEe+ru//uxrTZV8KkSy4VqwpDeFQ0lNky/J0M3oRlyc/K3hYLgCOHZpHfI1/j4DXDFkP/nEq3Xv7/7Gc4sQEQFzMVCIf6/6kVydYbkAGtzIaInP6T/9yKu//tqZyf5MNFhKka0QDK3Bl76wHGDloivBLnkfN0TWdJo1dlorc613Y1gpe2NcSlD4xMT0b7wy+68eP2z0CLWqaGage1xdHnN1hsUOcNwEFzFMxCPnFv7Zl1/lYDpCxtzG8hWUYmvqanLX9+EyrZR1wLE1FLjfaXeOK2I6v7ZNNsEy3NUItRrExMQ//dJLT55fSsYFDSVS0tWPEO3qv0duVT/IRfKnfuuZI8NezycCOShDUFqbE10ReWWOVfj/zNzGbGcsL49prburcR9rnKeTX0sDTigqewKzWFPOqnp16P/kt59ZIgnrNk+ueqJ7lRbATCTAPPIE+//+hTf+44tnepMTjWpXlWHZRkCirg1o/ZqfR84tbzJXthu6B7dehoWddkUnJKavPd8yhLXrJo0pAYzManLyV1449e9fOjZpPYsGcsF1lXOeqwyFYaaoURvtyKj5J196frE3AzDgQRFhhaiYea0cAgUoiCCzeW5zLEnlFZeDySx3TAiFIDTWZI4lql04whg2QylWwmZYYMlXERPLsYUprZCTsYVqw099+dDxOpsxkB3k6oVCAeFl38jl/HePvvz06dyrKkWMeyctneyazFEk5dAl77YR1jFKXf3Tew9Kwss0K/m1T6G0TNY6brlazrnfq54+tvizj74C8wxTNKsbCgVFIJk/dWH40w8fxuSmFRj+tZ/rool8SXZuBrdWGHpFB2sd4uDNeG2q2QJuDg02/MsHX3lufslZMJKrFgpLlBA8Ez/90IuvzvfcvOGq8CysUiyJrDfflF0yINQ6wJJeNIRWmyxeO34Ty5Ale3Gh/68efFlcJr1YteRdcLevnpn7haeOTfYmEYp1ApErBOvNMsBiXEzBTEB0s7bl3eK1mbcTlBSlCtEYNXMtuyRFZjgj0mDy555447GzC+aW4+pq5asNhRwC//KrLx2ve8klrSNGDUosWzrLtGuCFdXDcY0FrrNAuArhgpLBIFbGN0aDn3n4pRF5tXHpapJ3yc0eP3n+N5870etPLpbhbfg6OohiWFohcWmAsbSF1pFO8+q+yUEGLEXUsDSY+tWnjzx25nyPvCqSwysrsatBRg01EiJCQ0kN8K8ffv1sPcEkCwND1Po5DTXt7JbqiKsTkEwNPABTphDMsTo2Nn5SJth4biRHNwEzBRViBCklDzMxgDADzZSMoJEelQJAZgB12RDpk0ojMQPp3U56ZEVhlAGmODka/LtHjwQRylJurQKBaN7C1OyKnQUSgIeCIZHhZvb0uflff+Fk6k+W8/G2ibJuXvVYDoXtbbJooHSE/deHejSIIFRiDqIQ7CyjIGWuMI4ab4I5CVWWExUzFfPDPDc/i6gBMFyRCmwmjFQqgJ933zYpvA9BMocNpn/1+ZMvXFg0c4mFFsFUtLN1tR6LgMFKYzpEhZKALzx2+I2RlKBsmYw1uyh1hbelaaHiWrl0Zu0EWlqevK2KdV08jSiSPwhjNgQQtKCJpWsQpqjCjVUk1hjWCxdGC+em7Pw37+Zf+YO33bp9GqrNGqLp0kV4noAcyHx3SF2WeS+scEizql5fxM898XrRyhBrV1gL8LwiSCtdsS6ARAr0MKGh915Zqn/t+VPWn8wIh1NqXBaGFWJIazzRLQ3SDhvZChy18zCOKTXggVitN6ZlxR4zCxKBsaABwQIhMY9gjGo1zYD13g1++/5N9x/Ycu/ezR/ePN0HgMgqZIQRIoh+lDuIa9CHIyRQRqBxpchVmvnlZ9/4wU8ePNiz8glasbZ5FYZVWqEqWGK6onbDrz5/7KXzdZoZIDdopWyssLCvG6fFcX+5xD2QcMjGAXDVPTBXONBCbCUWcRPzhoqm0ai2ZjhV4eC26Xt2b//0wc137t50w0RVdSVURNReNiIRYY3kkAthtcGo6l3uABdmUxYGeQUVVdV78dzoP75w9L/+6P4mO51kAM4Vm+Tv0LCKSAgojYxuaSHri8+80fR7BiSlTATDwoLCGpw3X/5xtUR9l4yb3VhihwhhVaENy0lJcZMGBg2yaKKplxJGO/tx+97Nd+/bc8/Bzbdv27jdCTSCkJsGgoF0o6eSkxEwZyhkx7IWc52qKloogt7t45Jk8jADsuVIgy8+9caf+Mj+nrsYDtVApSuO7tOVXywnAgiTOdPvHj39zBvnqonNyGnEZBh5lEFurBd3VZbPNc7eOdZp6maFImhYNZI7iO3HkkaiyaOmyc1oxrV/0j/+oU137990z/4tt2yYHHTOqWkaMsgCnjSGZUNYEIYwmZij5wzil549Pl8jVSkjyv/yrl5B5hRohJFXKXvV1Oj1nzp69ivHz3xu95Y6UOQ3g7Kr9Fid5o8E5Jr2H545Ohu9BBck5gAcDK6nqpAFWj1uNxTpb8LNiQyADAuCb3EoYUVyhMglTVCX4oJtrUdAcnRyZcV8rfCQyALIMaob5OG2XnPLtsE9+3d8Yt+WO/ZsvqFXtSscHUEcacmtU88zyEqGgrJX7hTIhOOLS//88UNfePINTmxklr3rJTsCkBU1LAhiSITxfK7+w9NvfHb3FmNQpChvgMs3MtPbpZrmZi8sDh94+RR701KrZAyM09t1w78PKAcC4xWc1nkl7waGyAa7sr9iAQUFW7YcylxorCwfWYAiC6Il2JqgGcMiR0YduRlZ5D0TvY/ure67aedde7fcuGPTFqDqWiE1SLJQaEb7TcwjWj0h5KK1DvgS8NK5uYePnvvqoVOPHl146VzG5EZjnZkzKyC9a7/brlQlBYDGQNH6Uw+8eOq1PzC6qe8qbvTqcyxClolM9MGvvHri5cWoBp61frc5RbBbhmzx7W26Yy7UK2kQrpCgKJhL/6lUTICNrFWsM4QLEkxmsEgBk5QXRzWbeiO0f8PUx2+Y+dSNu+7cvWn/xsFE+Y1ZIQWCHjIr8HKqZW82NQKAZKkFxpxD/dSxCw8emf3qobPPH5s/s7C46D2lDRODFNHUxmCyqFyIaz1JF+QpvTabv3rozE0f3tVC12C8yqqwiE0FiQz89nMnFnxiA0Wt5z1hookYayiPrce9I8IrGpm6UlElQyMwmLpdxREoDzehDaBGyeo6YmGeylt66dbtk5+8Ycunbtx5846ZXf3lyq6WSDnDyj4H3CSjAUXnwAkzI4AGODSqHz1y+sHDcw8fOn3o3PzZESJNpN6Ez0xVCGoUagIu9QgZRuwUyK9x8WOa9cFvPnf8j354lxXWp6tvNxQwoira07NLj79+od+bzsqSr1e2nwJDbLGt7SZru7PawsUpspsZ6nLPwzz67SyG2SAHUihMomehqWs0i1Ma7pzu3bl/+pMHNn9y364PbZmc6Xociibg5TwqiwBHrCiVoKmAUXSD9QRcAF69sPDwodNffW32saOzb8wvLja0NMHeptRv9aKbMMFoJgYlD0CUMa+CKl4hEuRE9ejhc6/OD2+eqoqq6JV8Vnqr2CGA/Mprp48voppZJYa063rlKJbDMZ6JrSy0OtrhKxbqokZOl3qRYQjzIVIENZrzerTBeXBT/64btt53cNOdN2w/MNmvWq7DqKN2OOXhqUxLKElOoqdoVIM0q8oJHW30/MkLv//yG48eOffcyfmTwzSC9/o9DqZ6SCEDaua2s+toOkJSBZktAFJO2TWH/hTO/uR2bE5fOXTm5tt3I5q3wDCkK/8iM8YC8OArZ2qrjK5o7JpQJ71noZCt5smyDyuh0Dqlh7d5tuFNFc5cLeWoR4v9ZuGGXvrwzpm79+361IFNH925cVtqA1AdUQtOOY1Wlca6l/13MgCEzAhahX4NvLRQP3ns/O+/dPSh12dfOtfMhYms+htsygdQSCFCOaiGlUGuMOQAoyNKJgA2gERydbCKMkthQ/gDh079wO27+7S30HJNVzLPDCTy9aX6qcPn2JtSXncssJdrN0j5IgsSQLOUad7OTS0YDHNEgDKytCFgkUPDxeFQfasOTOOuG6bv37//rhs237xlZqqbMEaRgaK5iSrKKeo2ARRhZcJMGpznoBfPLDx65MyDL5548sTiawuxKPeeV4N+BYrMigxQqThTMhO5ihAhWoMkykOE5dIWaMkuXViV/iKDFNHvP3pk9tgoH6wshCu1SK/osSICbs8ePXN4oeFUYlY41m9RqPamkCUxKJNRCgd6CEdjoQAaF5VNVVhy1mDUgWbU2HBhS183b4o79+355IGdd+6e3jvRbzPxaDJpYFEVLqhBC4jM7gogBMLMzZGBw6PR88cXHjp09vcPnXzu/NzJRcr6qap8wgdmErvdFHV89M2Kwfi4H9mKF483uIvzHZPbrsrcQIAaVun12eFTb5w5eGA7snhVORYhZzSwR46cWgAr5mwu0NYzVyfJiBwSeVH3pXJCJkZQSY1ZZNa5bpq6SVHvnuBtO3ufuvHAnfu33LJjwx4r/OG5zk0NSxJcVvaQUcheRCmLpQpwI8BF4NCFhSeOXnjw0OmHjp559UKeqz2qHvsb+9MsNi0ooptfrsnYkBkgjb4QzeOvn/7DB7bzanMsAW44DTx09DyqgZABo2ydB0PkKGoMF70bSv3aJ3tMOZoYLkUeJeKWjdUdB6c+fdPOu3ZvPLB5anI5gc1ZEqw0A0JwGqL4F0oBI2kl1TqH/OyJ8w+9PvfVV8+8eOzMG/N53pL1ejbR7w1gYhOR6dGyE70p+1uDVbUSQqh6Dx05fR7YfGVHcwXDEkk/cm7x5bNI7pKIjFWoNa6zz1IrG8WW1hoBeFLE4pyatNn1oZ29u/dsuP/GPR/ZtXlX3/rdQw1JgnlBQ5Riv6iNlPmLzJwg3ZaAk6PmyddPP3j43ANHzr9wZvH8MMIr9jf0p9NAaiAFG8kQRAgqjHQU13Jp1C3ImhiVVy+dW3x9dnHLzMSVLOstZoV88eTc2cWoBmmo7IrAOhcjXSkLveJpbeulP3QwfeMtOz99YNe+bdMbWWYsysp1adR0cS5kVjbsZCGYwiyDPQBzwOHZxYcPHf/y4fOPH509fj4WslRVVk0PJg2MUCBHwxQEIqzgvtQTC8k81nzBLQaLHmJlfnKuefnUwh0zE9LlS8MrJu8ZePrwMSmCjjLKWN+NLBFsIsdFBKQU8L137v3eew5Mo7S5AxkByuCUF1L9khRLUGRAtFR65PA3sl48fe6hV44/eGT+mRNzJxaiUfLewCYTGa6siOLtRNQpXMMqQDHDQRhHZSh+ke7SGk1jSZgYYpEv7T11+PQfuXHrlb5uunzvnjgPPHtqkZRohTZgze7Ov/NIqEI5jTHID0BMORn1COag0UgF4e2EJ0ktq1aC0QTYEnB0sX7uxLnfefHYI0cXXz45P5c59MoGUzZjCVKgUQ16oGekKYqMj0djUICggk2LhO5yq4IDC67lV7OkEsUY+NzJuXlgmnpbdEPHoCiAPLNYvzTrVvWkDCSgXt98wiIMueVQlZCpQnURRMi8KjLvClFC5LCSQrkVwBYuAK+cGz5+5NTvvfLGU8eXDp8fLalnVZ+DjXRWklaQQxCGkKNpeTq6JplWJOmX5Ktjk1qzpiVkg7J6pqzkL17AmWE93U/SZVbnLuuxRPDEhYXTsxfYn86X/bl1mGDlwFCSgrBAeGQwhXHc4jNIEaITcm8r6WO5ef7Y/INHzjzwyrGnzuRzC8Owir2eTU86MyDl0Fv5mfcVu7c6kk2rqlPnz5+8sLh/+4bLRu90pcfwwqnzQxFGhiQSts6fiCrBOlaQBikxMiggla64giamCsAIfHlx6fGj5x567ezDh868fD7ONvDUsyr5zGRPBXeewVZIFl8fV1e4KQASQ+Gl03Of2L5Bl3O0l/NYEsiXTp0biYlkl/VTFNdx670yO7sQry/mgxNCREOzyIagVaQZbR569syFrx4+/dDhM08cvXBsrp5FZf3JXr+aHFgOBDyHygoPJQsYLSB9fZiWOj2Y0ndbAl84eQ637XmnoRDEEDgyG9nMVX4P2wnCer7C/bhN/4sHX7vrD31kyj1aiJ8fq5tnjp35yqHzDx05//zJubN1jFClakMacMoVAkNSJtVTE0Qu7QGawSmKGe9XNYtLi5+O+E2ke4YfuRAjwHmFUKiLl5KMNp/j6NmReQXQofw+kF0DIhof9H7xmTPIj33fR/dsnBwcPnPuKy/PPXb07Kvn5i9Ylb3fTxv6boNgwzwiEJaywtQ4y4ZV+3aRguVS3n19WFUJdlG4eQhJ9OrYhdFCaGP5s5W136VVoVoilsVRfXpu0W1y/NDYFcfr+cl4yvKq//PPnPuNZ8/2+unc0vySTdIHaXLrACAiRz2kR7Iy8gOQTYaywpozC3SYplJ7x6r5hovK2YskD1Z0u8YdE7QxpW0KAKsyfNNF4sByTyfPzy+O6k2Dnt7Uhkst+UrL1WAhGXlsoTnfyA0h1dZu62L9zwrLDMUnZ+aELPnUVK8VA1JumS5Tt8w6nvsw0FI6WElBqWvbxiyg1DAFUQClBStdAs/YEVAQjQghYAaRSEQmkZFNzKxMASjDbBWW2FSGF4RgJibG2UbHF/PuARAhkshRWi2wdGlJLAA4fWG+zmAaP7rA+6H2aZeqCnzUiYuEQ67cRrqE3ezathCsVfmIwihhRdeYjNKObR+9LCDLYK7ADG/C82jk9SyIxvre7weiTuHhJnPFatYTLUGwkaMcJ2fnsHlCaqFrYw6BNPZyy4R2wInZ+VEOLm/Pvw/TiDVyS9lzoZ02uYcBaAyCLGRlD5ICjZ5A1DmWRlFFs7Vqbt0x8dHduzZMTz55+MxvHZprejODZkTVtdEReVV0pi6eFJOjnE/NLuAiCBgvqgp5UfrOUwujJlTx6ycxfc+uFBAkC8DILDRkptxYiSRdyLmu6+HigM3+Sd5xcMun9239xIENN22d3kgCGt277/965ND/8juHlwYTVQ6i0iotc7fuZ1lvoc48Ob+4svAbow5TFyOMK1gSz40809OyGmHLbcMPDOFaXw29iGYYGlBGJyq4mjyqR2I93JjiQxt4961b796/7Y59mw5OdjuJQIQaZCD+zN0Hvnzo7C8eXkxVxcAqEcOqdMmlkmYBbMDztXXuiGwhlAKYVsaFwqaTgXNLorkurVI+cF+rUE+YKA7CQNamOkeMmirP7ZjQh3dM3ndgz737tt22c3pX1Z5UkzUKuMEL5xFTE0HhroPbf+Wll1BNZlIwvw6HJdL83JKXFtUlSX5ambuWKWENzS6OQP/AkL724gl886t4cYZSWjuWGIgYjlRHrnzp5incs2fyUx+69fY9m2/aOrWpM786BCERSQEvjbQyaMsGA23SwjWqVENVNl6H9QRBoM8uNhrL9LFrYwkJYBGDLBPBst4xO2rCfLw03BIQfmBol3/ALT2ImAshuitlGgUrQFMU2DK8YI+sRTlEk5u67jWLUyn2bZ+5a8+Gzxy8+c4dG/ZOdWsaQFlXI61dvo4MszCgFPeQoWhawyhCmS4VRr9VYFMuayHthE8C5D4/GtZAv2WIcnWt0LTsrzrSgACGdfNBPvWOn3e0HDay0hcMZlfthf8CKLwsBjRuElTXdVP3otk9wdv2TH9i35Z7btr94W3Tu71NVtQoLJMEnQaqBiCmRoU7PLMJQxXJWpxPaVsQFDKTWiHS63PvHBZxUV4qJppWdkvL+DlLo6Ym7QObeWftTYkmMck8GJYbQ2YlwSwXPcQIjEaZeWlguGG6f9eeTffvm7pn/479G6cGhRJcTYyacJOZe1nysmKwxkpSowbyvjmQZAiheMTx2fVcHVXk9YQ4c6muG1ymY3zxSIcAkKFh0wD9D4zmHWXfpZHZYnbbFX4Hg15nNs2wyktbPW7aMnPvvj33Htj48T3b9vTbJlNWIBoRWY6q2zNXCkQZ+DLQbmmgl4nXh/Hk8QtPv3Lov7j/I1v7SQiwJQU1wgoG+nqaFVE3jYQ3ywukN7fAoM69fpBUvX3aIZNED6uCI2cwWzPyqOd6GO0b9G/du/Heg3s/sW/mlu0bt3JMDyKFaCRIq1qor1rUMqIJGN2MgHMeeOXC0hOvn37wpaOPnhg9cz62aP6P3nfrNtRZRhiUuz6RCjnh9UQMRETXiLA2JHaGtYxk5/sCK3p9LYtBqyTVwwVhoY5tNvrIhN1+65a7D2y9d8/GmzdM9oB250dl7E8SMEPxMS2Jq2exhiciuQieyPmFE7OPvH7m91898fTJpdcX2aReRfUmfMBUk0DfJDKKgIC1mIP31BessOgVsJkVPfkPrOvtzKmMu9g0DepFNUtbBnb3lsn7Duy8b//m23bN7OpV3pZ1uZacbkhtD7rdR2g9F0XRaeZABl5ZHD7zxuxDr5187LVTL5wdnWo8Ur9XTfUnvMcEIudhzV7HiV067AbASXsPBEgvNpaLDavAjqMIXRBFLGG8PNK1ZTTuvazr1oAD0QkFtFSRhfDWom0zlRxYtFaYBCwY0UIl6pBFjJqR6qaf633Tgzt3D+760IG79m75yJaJTW3FI0VdKI5J886eiiEUZsEAaEzmAOaB587OPvb6hYcOnX7y9XOvz8VcOHs99ga9gRfwhRRQAyjEAHMLpqF107jKjEzRkfyvxkmN20/snhMhWkoSGEIhH4jC0DTOsQKwDBQ+MfO2iaUV7TzTus+5OuH6cY5bQCD0gAmZFtaKjQutjJpIOAgiN3k4Hw1n6Ldv6n1i98x9N+368J4t+6d7k126kSNAI2FMLedtoQqUJIay02gE4cCJRk+cOP3gkblHXj35wonZ47UtsErVRG+SFS3UQvHHTlKgS4YAWg5Ja+UWA0DF0iwjV/+sCvOJgZJo9GWJ12WhihWd95bchDD2Ky+9h/eBk7rYa2d0K8dBiKauaA8izCAnwpAJyawmcm60sDgRzebKbt01fe8NGz99cNetO2a2VAVylGs1tcqARV7A8CvE36VsIOlmMHgNHF0cPXLkxAOHzj965Pzhc4tnG2bv9foTPmHT9CxKliOumI4QAeY3xTyzlvN/9Wquy30jVZWB1rFRYwwwSm3ML/QBbLedJ5xjUudx3Ix1bmIteE/L5dN4yy+YKBhqs9qUImyYa9VLE4w9U3bX/o2fumHjJw7sOrhlcrp15LnRUhPmqKyQc4uiZxoBKmcIYe5WprGnpFfPzD90+MRXD5974uiFE7MxhEdVpf4Gn+xREWoIIcJQOEIuS2UgsNBgIb9JKjYZO8rL1cf5qsPJKCar1EpIrAQ+FMPiWAe5VXfnlBuiXk0u/feo57Q8kSgZeCFNMGdDIjLr0TDl+ZlkBzdX9+zdfv++TXft27p7UHV95JwjSCO8gsMAhsILH5ZCQgRRmTvRAEeH+blTcw+8fPTBIxeePTV3foSgs9+LmQHhVUYo5yaTlKqgKBkiYRRgXFk/S52U7sq2Aq1oxF6P7mgHnyEjJgujs2AFOtaRCXZVoSDKqSw4sGFQIRbRhUK9f+rE9p02ICFcWcBSRjNsehE7JviRvYNP7dtxz74tt+7auq1T84XUlBUnKpFQ0fpVAb5bhOgwKyOZReDF2dETx8589eWjDx0dvnS+WQi6Vf20uRqkIGpma0Q0LCpLrAWJKTrmRXtL1hmx0IJr/F/LTXmxrOt8VIoN/V4C+CZJpdTqMcGBQAhScm6Y6F8y+nl/2BaRwTZ9r4dLdT2aYtw20/vIjds/eWDLvbsnb94yM0BXh+Xcxso24UaUlFQAIysouKXyZ6ell47PPnr0zFdeOfnU8eGRxbo2Y+qniclJGMNCqtFkQmAlUsimIIEKCIJJHa/k2zGIZqgZa0KzS2XaULiKS3omXLKTpNDGyb6XHVbTShR36t7jgCC4oARsGMiiZrljmUuFEGJdQ/0MQaKWc2FhYzW6bUv/rgM33HFw153bB/s73sdaGCFcYUQ2lTWSlp40CHlDOFFYjjPxWl0/emz+4VePP3zo1Atn85lRyPsp9arJqQRKUK6DTVBhBtEEQo2TsiKz3IFsigIZoyV1uUwKzrFmnJQ7qdgxPKaQireC9qs1vCo7HQx6Qbq6YibJgKbFijYrPVYB0WSTZVpgBPimPgzZpKA56MFsYet95ZewBtvzwg/fu+Obb9t9y5apran1DcoRJMhUMLcGyUiq6E1kBUFzNwIYAi+eX3jo8NyDh089efTEa3Ocr8Vez6rJXs/LXKZRHuc+gEEXiYpxeU9rDExC5kp0+JX6SEZkCzVtusyxdqdbAdtxlXa/utZLplxwWEM1rtg8cLRENK0DKt2F1HYaupy+uLrNU5NMVYgOUNF4cXXreP2LQKZVo/N/5dtu/y/v2AUMG9kw51QEmWltL6aVZraiikQRyYpbPxV69uTZBw+dffjw2edev3BsxEXzfprsJUz22AAZLNLA18GzLyt6dlM4NzNSCFstlo3iShkMKFsgzL2qNk9PjRvwKwnU0nKgoKhS6mDnhg29lGrAhQAyI0jL69mwyOGo+cS+Ld93x66oczajqSIJBlkzJ4TJalgoBiTMSmB6fTh6/I0zX3rl9COvnzt0eng6M/tgkGZ8yvoWFEfRjWhaFmOs5lNqmf8iLk3vncZVHvQSyISYUybBRpxKtmPjNIr8okCzzrbYLUywpXYWDIidM/1Ji7PITjchc/23SYlomn0bJze21L2VoQE9QKixTCAxWQ/IxDnghfPzjx858dVDZ598Y+71882SKqUqVVsH/RCaTOWA1x5QNkfbFLsOGagBWUKzwrAKWy+LGpdWb1tdpX8VJW7LZZr0vGO6V/Zzui9yqcfCCvUibhmkrT2eHtXGiorlVPJ6dN9Wy7JcTdUsCGja6Z0ZmoA7U2UI4ESTXz0++6XXTv/OkbnXjp85tVQvpL6qiWqqShIV1IgNRZNZClJsfEXVj5UtgNW4gzKisxC65F3s3JTb+F+1ekSxBuaSlNMQ9baBber5uOMeKxa90jhSB4paJiFNV2n3hslnT1wIn3TRSusL65q7oWiO9IvzMhVdkGjMjswvPn30zO++evLBNxZfOzucHxFVxTTNae+ziA5kQVFm9W4BN4QQYlmxsXYguGxWq8V/PB7gFsNamdOYu5EMreZuQjDMCuWAWV5a2rN9eqZKY37bGCu3g2ncBeV4dC1NGfZsqvB6oF9+yNc9ASkgurgseglKWWb4x1984GeePbM0vR3eT4OpNGHW2MgkwDJIM5V2aMkwwpU9mMlsJKIcb8fyVDiQVysmjrcY3pRiwcmi4r16KZ4oC0EegjHQ5D0b0ySgAK1wuOOSdgMJFKR1+QsG7N3YG+QUyEGXKrBe/wPpKDMqoZ2MhiUDLsCHU9snJzbkCGRl5kArlFre/laltw1HFNiMGUW7EkzLLLWrpThS8hCHGOo8llYOfQUCZmKDVdLqDtCkCsjUcADu3TzFcduD9OXndNnSlABw845tlbkCZGMIk3zdA5UvgVeOhTAThIhQrIs7pKTIy2PfkqSYuxlWObAYKKPEJkSj3bhjC65Qs1yx53Fg80S/MrVyCdE2ddb1XIeMWMly0g2jbT3dVJlA55ZLFWoHQeFFg0WxekekVmFXsAhwZpAObhrgCpZll++EQbumB3s29aNuZFBR2ON6T7NWWtPFD4xXej5ry1WN/+1ice6ysDreV1itM2r3NZDByPVo38aJXdODi0uIt/VYoS2V37hR0YyKurDeT5C/N9eLwioC5K5xosUQmujYNLpDMZZFsFW9BwnGUh83zU0bsMUNV3CRdlnDFFgBd+3ZnJrG2uTK36/bYDRbdy9CtMl7W8cDMlshR8fV+VgUHm5QKUXctW+LXRn/ZVeMGcBtuzdNOizTBGqdKzR1seTN+J+ywLdemCmKCnDJsbSCBMhMdpkwf22LUrQiZZmTzlt2bHgLL29XSHMBxb7tm3Zt9CYvwhDMUsI6lxGowzJAWEmBOZ67dxSjrbjpGl2BE1TKsjxqg8gY3GCVwamgCfRV6TVYZjIh6DkPD0z7/q0bIdkVSp8rGBao0M6+f3jrZNSZcAC+6iH8g+ud2ldWFwrVdtxsedd4tV4JQw7KwMj1zTsmdvX9LcRe7EoON4QZ4J7921NR7QP5fkPAv3X5s2Z7JixbfOM+VpsolihV1B5W5/WnFCUlakZ37d8+AcSVfY291R0Ad92waVOlUOSLRK3fV9cYbqL1YFgSC4E3LuqdyCC3i8Wur/UnB43wrNja97v3bu1ADbw6wyIBNbfsmL5pc1K9BLMg3y+h8KK7cPcylVA3NF3r9QcZl4KXBdIIKXAZ6pdrcwXNaXk0+tDm3i1bp6Qg7eqS92JYkWOr2Sf2b0G9ZCtmnOs2wjFCl5C2r8P7IcAmX0x/LRiQUlrNV7/wuOdUz993YMsmUgFeOYhd2bAQoDlw7007J62oyKz7SHh5+iitJ6NqJzhx8XshETRSKrBoW6UPl/JGa+770M5uhTGu2mMJDnNAd+/ZdOPm3ijXTq3rZkPJbAMAMtpl1dCyrBBEuSCYuEbrX5UNInAEb/dES11mBiCx6KTEKi0aGzis8/6tk3fu3MAQzVi+xtUm72DkiJ1Vuu/gtjRcIE3rGefXFSSXXr4c4rUOkiwIULMyehQ/Bbixm0lf+3Nq9yHqpU/dtHOHeyhgeguU/VuGQqiwsn7Lzds3o67XfzCMuNR1EzD3zvLWeg7Jlj2IOXcYey5vWJk7i0bSKpwTiRA2Vc233ryDQG4/JK7asIqNOiHp3l2bb90+M6pHXOeEfxrPble80+sxfw9dyiBvQCp0M+Jq8DKKWGqWPrZ95u6dGyR5Ea/T1XssiAYSrogNyT576w4bzXF9F4UtlSLJlepBXfgoSwJrOth3vC4Mtbs5K23LzVbIgV/zDItWz33rLTumzLJkSHxLxIu9hYVSCBDGAD536459g8hNvM96pBrX0evmxkxknaOgkqmLDGu1eu5AbvLBCXzrrbuio/R7a/K0K6IbcstCF5kWits3Tt1/YFszGsLeb/zv5EX5/foIhR3mXUX4onCXFI+FVWg3msXS8A8c2HnTzAARhEGhlpn3agyLhYbQSMKFkCrgez92w0YNU3FizJQX9hWuH+8kKLrNy+XUhF7YZVxlt36NLrm1+/+oQeSWwZuwMVcIeu2wMOuafJbc2v6SXNqs+nvv3GNAtCL2It/Kz79FVVh+yIxy85H0yf3b7t41NRouGdWqlLJo4a6XGMKQlikNlz1Wu7hFLePk1uTbwnbtE8wrebe5gkRPuCZyuLbMixZG1Euje/dO3X3D1lqCefcRfMvf8Ha2KwUVCG0wfvfH96S8KAjqybKpWV8brO8X0A9bAZuLB+fmzmu06E/k0lWnBKZes/TdH98zSSCCindmmm+btgFQJIegb/3wno9uSbnOYsqUa111THXRAth6NDKV1iLReqzOskqHtLJCzIh3324QrNUVtzQaNndtr7755t2SKqdRfAfTentLiyqjdJqZARGxu/IfuGuvLy3AskmUZzOtw+N5861yfWSL5TytdHqli0JSoU1uRz3vLsEKpDLXoqXe0vz3f3zP9uTq+NG6ls1bPTB7B7fR/r/RQvr87fs/soVRL3rLo7yeisSu/XPR5ebsONnX/kshUOQKtpmWKsiAVGDCfPcpYlEWo1HNcOnObf752/dFi0Iu1CNvj/uyt36x1dauZXZAZO3ppz9yz16MlipRrG1dsfwpAnrTJgsvajqscYdVcMi57NiX1k9HcGtWSBf5rj8kTBmEUz5c+IFP7NveS60YRqsc8Paptb2ToLEiQ2QovueOGz+2ubeUl+S0MossBjjGNa5JY+uei8YrOcs1oEJRWIxV6tw16rxEojFE3dFNouWpB4DKSk/7an1vR+bYnaCJBoRpOFq8a0f/Oz66P4rmy9Ucq711HORFMRzh0Yj7kv2X9+5nvUS6FRI3ruCZXKOAk0J+UkRBSst6Wc+lUMsEjIhW3m3NeitkAo2sSAmUTLp0KnsIBEVe3SqbuEyH2vISmhjmSPXSj3zy4M7EOhSJy/xp7yDWXlWGpEwFEWo+/9G9n9mxMS8OxRgDNd7cWVl7GYr0prjXcm2vm4hetC9KP85wUbuhQGiuMnUvnmr5EBmQGeq5+hv3bv7Dt+6WMq5+keaqDIsp6FCOepPhRz9z03QzMpm1saP7gkV4ew36reU65qJHb2XEti7268EizNbky7TXrSwe4iowKK32zwrXIMIphDZF/aPfcNOMKasxKF3llNiu6rZM5qR7b6TmDx7c+vkPbx0uXDBfCQpa0y9+zk3Epbxo626sTjCHBC3TnFAA3NGu3H5tOW7bQQga64XZ775962f3bhlG43Qzv1pGGLu6N94A0IIp0Af+9GduuqG/GLl2aX0hBNb1FWAOxaVuGDSR7yIPkYxwSM3owHTzo5+5qSckiTIB8Kt7Be1qHBbafR8GzXPojs3TP3L/TbEwa0Yv413xHad3H1xfYxUCMkfgommhAHgrK3e18jQGGQsPUoTRtDj/X91/8+0zU3WEWQLDURSYVivHapXExLJixsjxx++++b69m0eLSzQA4TK0OgNrMGdZub6isfe35doo1vgrwa5NJUU7TddyubhMY3QVNqB280IglIzDpcX7D276oTsOKiK5giaCcdVkEHZVx+IAzIiUCtOXcavzv/ummzdhmKNx5qAD1q2Ar7nMN4NqF9DVtVNQuRMmREcU4mvVtOStpEiIaMAVpkEAqVOxf+c79gI6RlUnmlp5qy39lc9+aKMRpKHs8iaY+VW7wXfzApER8dndm/7kffs1N5dgtRXev57W3qiHQCi0kvtnnYbCUkfp0j9O7iSvqh4JmNAvbOuJnufn//T9H/qGHRvHDNtf8/Vuj59miuZPferGb9g3vbg46nME1h5Yo5tiLWHReq0zOpl0hDBW71V3il7aWleTC7mUsoXVTMPRQvNt+zf+yL37c9TvfsBl18AN0Le6/7Vvu31XtRg50xpZ0Zpce696t8ByRS3uNb5T2H2/0DLAcjxBK+Jk45fnHRpAdlUINrGnv/CXv/W2jWZSuhZQwXd9JbDOo09u3fDffdNN1fz54KA2Zq7BU7k8rL2TY1tleaVr8WYU7r6SZixbj8Y3ctXAhiAas4b9ifnzf+Vbbrl7y1TTDK8Ji/Q1MCwqV8Qwxw/dceMPf2x7c2HWXSs1EdeOx5KkuNQ1sdB3rpPVttJcj4icxxDkTk7Hi8biVdiWo+mZ8tzcH797xw/ctq/JSiTYrAnDEgVUmZakv/gtd96/x/PibLKO4aarf9/zcyMZugwpQ6FHbwt3rmky0nGOJSErLnFZyd9+g2oZ6Q+aRLN6/uw37an+wjd/PIUaIuh2LbBp18Cwgk7GwJSh3T3+T5//2J6qruuoGESZ8aqU+e/5mWmsfltmCGX9UxBrRitrDOS1GRFLX92QDYJs1CqOZZLldiqY0QXoipvvpdki0UyopKaOD/X1P33+9q2OEPoMswxWayLH8rKGFOzJoolPbpn58W//+GQ9N2I2NNkjEwFlW9P0Wuur/aCxLPSKvecWQApeoVMgwBpHlAzNRiPTxjz34995152bZlQ3hqKIdm3aeHZNzoRAWKtkXjcLf+SmbX/xm260uVkwWYRkSWEywddircX1k2F1RhRSvGlbxpdxM7pcKpxMtMgUk7Ij+eLsX/7cLd+2f3OMlkALQ7RKb2vDsLo90AyDkkeqGjV/6p4b/9Q9u3X+QuKEU2LimJ3qPX3R9SYsollpV69101rOJEgBbyLOAa1Ttr78MQWVHW4S2dOF+f/m3j1/4o69wxipSnJvWcF05V7M9a4KW4W+7MoAK1UG70f+7z/30e/76Obh7HmzVJPhYe8t73IhBXnTi76OKHTGI1hF5Mt4rAKRvYJZWBMpBDL54vzsH7tz81/+7Ed6USdWRHLBkQ3NtdJ5uiZVIQGHEiBGWMBF0AbSX//8xz9/Yy8unOtZcWt8r4/lfbKyqsvpjZu1DTle4ZyCcFOcP/ddt0z82Ld/LEU2WRIpIQBZ0KRrg/+9Nv1xyjK9ocMEi7AsULIdpr/13fd8dvegmR1WGLT7JHrPNvneN5vQobiMkL1Z+1BXyICNtxEMTOotzi19y/7pv/0d92yAAiQ8kMNqeDTwusAM1kiOVVACXsoJOmiEObKbsrinsr/z/Z/4hp1pNH+u8jZNtjDKhOD12x4r++GM0rYu/ycCqAwZRoEKE0Rbs16qiBoRlmH1cgOhzbZ6hFEBWpTWXAiwMJOZlEyj+fPfvHf6b3/PJ7Y7GpgbaDIzQwItEb3xBsAa8Vi4GMfE0owEYKxDeyf8J77/4/ftrBbnFmGo3bLTMAyyNup6+RFyTAqyQl0ZGLfdl9d816hnK/hQAgwo57jEF7c5ltjR+DoR2XLtTVQ2N7/0jfsm//b33bmzhywaGCCYgdIG47VFoq3a26nEoKORYyHyTZP+D77/k39w96Rmz/VYE03DyooA/HWMhxFxmeS9jcpcHiSu1Wx+/CKok4Ve+YXdffy+EJHCPJII8xyzZ79t38z/9r2fuKHXLChny46wIJRW6avaqj0CgcFgpZwsRsEbB/a//9E7/9DB6Xxhri+rgkCPka7nIepyRO/L0u9c46mYWsWTwgG0XIh0euOdEleLBoVcMRHWnF/6wzdu/Effd8e+CiOlHlUpKJFvxZy2Vg2LtRiCM7wXSGa1tKtvf+v77/3u2zYNZ2fdlDhSK6pw/XqhWg6CK9SyJKwLAGBnByv7JmNMg5VZJ0lYQOGNXM3c3A/ftvnvfM8ntjhGQo/WExkueDAH6nVmWKXPC4tsFuw5ZGZ1aCvjJ77r7h+5e2szdwYYVRzZ9euaLrurlY1Et5UUF2uf8CuKYZUca+W3dW/ZTVx5gGEgmsXZ//q+nT/xnXdsQh7CEs2FbFU2g2UTXas1C1mtEEu4KKImDXILwQL0CGxG/Pi3fWzL5ol/+KWXwzZ5srhOtsVl+gGtbP/4m0PO2gb8UdK4867u+7q3REZuVV03Mzr/lz9325++60CK3CD1AKqBjDSwAQKstFqCTqsXhtoyKxla9psir1mRQSLiL977ob/3HXds52hxOHJLkAzZ0BCZ7Q5Tobew0rEj9O50+AQiK3JH9c6VK8NqB7eFC2HNKnAIBtAQDaJICLTuCyHAEClUMc+OFnal+PvfffefuetAExH0VO6PBtIAgxFpVYcOq5jftCtJhUuJLHs9EAmjmdWjP3rLrn/8x+68f8uwmTubq354ZWGKCcq9kL8IDhW4SIDv/u26eDy7LHTC7sVX+0KsWW4mdniG1rA6HIwB6Fsg9YdzF75ha/6pH7rrO2/aEfWQ3fxQLWUxsXwuq3jZdX4qsEzWDmVLTTO8f/vEP/7B+3/w1k3VhVNqIvtEkNkUsMIhAMk6fVh9sAPbPciAIjIAU0PkoiUZ5lo49cc/tv3/+MFP372lF82I1nOAqMHmOj+8dD0/rJV/kEwR5pn9iNg9SH/7u+66a+eLP/l7rx3FRDWRFBGo2s5loRcKyMbsFdcmjVe37clWE2Z9zHvKMwypxHTKCMlDsCnkH//WD3/nnbf00SyFpeQUHBmMAli6nrZ1fccXEuBgj2KlqAIVTCEqfuSTN/+jH7rnM1szLlxIwcQAm6CCBYf6rqs1tSbUscIu99pLW3F5f+f6P5avybxKvZPpYRVBKnZP+vffeUs/GmXv01PAFQxIPSld5xfnuj5B47AQLYVFWCaDDBddHEW+b+emf/RDn/6z993QH12I4fwEmmTRlWi2Eo/0tVfqHVmf1uE8euWrpWV+/UyFwAyT0khNzYQuKZVFWMGaZa5ay+q9N6yAt5yDyAEELQBYY6j7RG60w+zHPnvbT/7A3Xdv7dUXzlvdFNmhQqzw7tvEupKgOLVW+SYuY1taUc+aQBVCPBGpF+aIbGPGMgi5qCnF9R2uX9cPE6ryiQ5PcBesTaMIWM9pgCK+fe/Wn/rh+//cN968LS9pbqlCuAUKtwJg4cEqE2BGURRWu6nR9SmuAK7nMpXfym4WpfLcV84AdP2eSfm2AoKIchdFJZVSJnKrxa1sEuEgacOl0ahuXa/MHWpbUi1qvS3/DObw0mi4zrjw62pYvjxDT2UCAZBIRNUiz41mFtINxP/46Zt/6oc/+R239Dk8vzQa0gZATwBMSXUVOWWzSJR1NXiMHc+VgubKBeLlb1Woh2Vjlunr77g6Z1wcDaGeqapC/cguyIxUT01lVg9zNX/8P7tr5x84sFOhQu5OWEsbaS1sqS180C5HXDMo+9qsCt9xKkapUY5Pbp/5yPfc+2svHf+/f++Vh46fj36/6lemJkKZXpulkAVy2zpvW1BvdX4Rb86u/CI/db1bGq1EYnG8rXEX7kobWgXKmA0EvI7RYH72szum/sRn7vi2D+0aAE3Oa1aMLa3NrwU64Dk0KXzvh3Z++sD2X37y1Z958NAz53PuTaE3kRmZtQEeqR0j06gYjwEv1/S60gZLJ1r4HjXK2OIRWmJ+goZR7aqZKiXCcj3vi0u3b+v/55+9+fs/sm9T8siKLEulUeIfGNY7f9YsMldwNZG3J//Ru276jtv3/39PHPqZx469cub8ROqxP8hkyUjGQO0Cs9TbNIIu07h9r6Y4HNPO0yAYZAooVYqB6rw0VJ1v2Wo/+OkD3/PxgzckB5oF1ZVXyUt2aGtzrrlGDUsUmCFjMLX7mdrRS3/+Ex/6ro/u/+Unj/zi48eePXO+ThO9XtVDbkry9bVFsjVyMAoCrqig7FgaNsyjj25J3/OxPd91x74b+hUhRRZtggHUgYqksQGqDwzrKk6bSILCwkQiuzOiaSL2Dnp/7t4bv+/OG/7j8yd+4cmjjx07Oxep6vfdGW3Wzqsq7LgGOJSLSE0iVOfF4XDSR5/ZPf3dd9z8Lbfs2lslKJq6cYfMApYEIDubgGUkxwce62oDRFEfYi5lOcycrsgZ2N2r/uTH9n7vR/f+1pGzv/T08UdeOnp0XrVPpKqfHFkhWOm2i6GOAF1hK8S4W5lVLx0PKJANCjDIFRsFalkl1So+dBKRXfBkjEHNHXCiRaa3IwOxmx7FMncECFIQmY1URj0aRTO/d5KfvOOG77x912f2btoICMohk3kqOaASAm0NGJSt2fnpmk3ex70QohMI7iYv3rLnShvI7963+dv3bX5x9sBvv3DsPz33xhMnz59brDz1U0UVfqIMAGEMKKuuO7TJmGOqtCuCkNxKe5rEGBpfLBRGAexIRMpwsbCrR1nZ5bimtChpU0BWlnmjLf9UwBoiVMisQqM6oh5uTfXHt0/8wdtu/OyHd988PdlrmyOycrfARdsqHFfPcHxgWKsQOwQoohJunxncfs+Nf+yeG584fuHLL5z6/ZeOP3du8WyjuupZsp47RQeMuczMTCQoqwFvAEPOHnVUyiBrz2y8uJ7ovE0ADEbnjTAmVCescCCJAcJCLkgWtCigcspCHmDRr4tooGYUPlrakuyWzdX9N+/7hpu23rVzZgMJ5NzU2dytXZhfp1fCer4I0CwUyrWEzZ4+u3PDZ3duOPUHDjxzbPaRV0898NqZp8+Mjs0viZWMNSp2EMSGhVylUGJ5isyAldXC8Eqhsm/Aoq1VDKqs8hjGViWxhEK2cLGgdaSgbCmHRQkRitFCRGNodk5Ut++oPnVw38cPbPvIrpkdcABSDKN20MH3gRRDWu830AA12bPKC143csC2GL9x16Zv3LVp7n4cObf01InZrx469vSphfMnhlIAIUaBUAKooKh6YGWsI7mk7Eoho3LZKm6FndphW0ggotAkCCCMLNp6oJXxE3JNNU3TqK491AM2DPoHd/hHtk1+6uCe27ZP7908MdMVgzlyqVASHbCGcNI+MKz3+gbCFKIJVhaxWRTXMrKpz7h1U++2Tdu/98PbZ4ELZy7smKqaWCL7HsgBGLwZ1udPGnYRdU5VDxk2GlkiQRjR0sAbqE4GSSpr1JKDEcoRCuQGORTZzSY9DTxv21DdtH3DjTPpo7u337x1Zs/GqQ0GB4RoFI1gYXKjK6m07SjIkW31EZ6rX36te54MoXBadFI/nSyy2OpyZ0BeVscNUlMTjsqzhAy3V89e+JmHXzraTJ28sHhydnG2aUbhddM0OepQk1WiIjq9yTLSrcx7Zsm858mTqn7eNtPbMz2xe9L2TE3s27Zl96bJbYNqW8+rsW+VRUZGY0xGK8E0uwxd4WsrWyD8wLDea8tqBzha1uJsqWw7YSwpjCIV8CiLLK2CZMmfHBgCDTDKeTY0uxCzi0sLo9H8cLRY16PIOSIiSkqXyGQ22etN9vuDqrdhordhIk0lDtwHbwoBORQdcpaEFQxCqzlUKklBVLeHza7Vst6v94NhXdGTvbPzkYrhXQtav3YY2Wm8r1yJ/TqTrXofG9bXYonL0XW5h6orFKRjKduLargPFj4+MKwPrlW8/n+ovZ055SoMqwAAAABJRU5ErkJggg==";
const HUISSTIJLEN = {
  houpels: { key: "houpels", naam: "Houpels Valuation & Real Estate", kleur: BRASS, logo: null },
  huyzen: { key: "huyzen", naam: "Huyzen Vastgoed", kleur: HUYZEN_BLAUW, logo: HUYZEN_LOGO_B64 },
};
// bepaalt de huisstijl op basis van het e-mailadres van de ingelogde gebruiker
const kiesHuisstijl = (email) =>
  (email && String(email).toLowerCase().endsWith("@huyzen.be")) ? HUISSTIJLEN.huyzen : HUISSTIJLEN.houpels;
// laat rapport-onderdelen (zoals ReportH hieronder) de actieve huisstijl-kleur uitlezen zonder
// die als prop door elke tussenliggende component heen te moeten geven
const HuisstijlContext = createContext(HUISSTIJLEN.houpels);

// ---------- reference data (uit de aangeleverde Excel-bestanden) ----------
const KLASSEN = [
  { key: "bescheiden", label: "Bescheiden woning", basis1998: 420, type: "Woningen" },
  { key: "gewoon", label: "Gewoon huis", basis1998: 495, type: "Woningen" },
  { key: "verzorgd", label: "Verzorgd / comfortabel", basis1998: 620, type: "Woningen" },
  { key: "luxueus", label: "Luxueus", basis1998: 745, type: "Woningen" },
  { key: "gewoon_app", label: "Gewoon appartement", basis1998: 570, type: "Appartementen" },
  { key: "verzorgd_app", label: "Verzorgd appartement", basis1998: 645, type: "Appartementen" },
  { key: "luxueus_app", label: "Luxueus appartement", basis1998: 745, type: "Appartementen" },
];
const ABEX_INDEX_1998 = 475;
const GEVEL_FACTOR = { 2: 1, 3: 1.1, 4: 1.15 };

const VERDIEPINGEN = [
  { key: "gelijkvloers", label: "Gelijkvloers", defCoeff: 1 },
  { key: "1everdiep", label: "1e verdiep", defCoeff: 1 },
  { key: "2everdiep", label: "2e verdiep", defCoeff: 0.7 },
  { key: "zolder", label: "Zolder", defCoeff: 0.5 },
  { key: "garage", label: "Garage", defCoeff: 0.5 },
  { key: "berging", label: "Berging", defCoeff: 0.6 },
  { key: "tuinberging", label: "Tuinberging", defCoeff: 0.6 },
  { key: "terras", label: "Terras", defCoeff: 0.9 },
];

// ---------- dropdown-/checklistopties, exact overgenomen uit de SCHATTINGSFICHE ----------
const OPTS = {
  // "Boekhoudkundige waardering" is bewust een algemene optie (niet beperkt tot KMO-vastgoed/
  // Bedrijfsvastgoed): een vennootschap kan ook een residentieel pand op de balans laten
  // herwaarderen — maar komt in de praktijk het vaakst voor bij bedrijfsmatig vastgoed
  // (jaarrekening, herwaardering vaste activa, inbreng in vennootschap, ...).
  reden: ["Nalatenschap", "Verkoop", "Boekhoudkundige waardering", "Hypothecair krediet", "Echtscheiding", "Gerechtelijk", "Andere"],
  vastgoedType: ["Residentieel", "KMO-vastgoed", "Bedrijfsvastgoed"],
  bedrijfsSubtype: ["Kantoor", "Winkel", "Industrieel/logistiek", "Horeca"],
  bedrijfsEpcType: ["EPC kNR (klein niet-residentieel)", "EPC NR (niet-residentieel)", "Niet vereist / in onderzoek"],
  bedrijfsBestemmingszone: ["Industriegebied", "KMO-zone", "Gemengd regionaal bedrijventerrein", "Kleinhandelszone", "Woongebied met nevenbestemming", "Kantoorgebied", "Andere"],
  bedrijfsVergunningMilieu: ["Aanwezig - klasse 1", "Aanwezig - klasse 2", "Aanwezig - klasse 3", "Niet vereist", "In aanvraag", "Onbekend"],
  kantoorIndeling: ["Landschapskantoor (open plan)", "Cellenkantoor", "Combikantoor", "Flexibele/gedeelde werkplekken"],
  winkelLocatiecategorie: ["Kernwinkelgebied (A-locatie)", "Secundaire winkelstraat (B-locatie)", "Baanwinkel/retailpark", "Shoppingcenter", "Randstedelijke ligging"],
  horecaType: ["Restaurant", "Café/bar", "Broodjeszaak/fastfood", "Hotel", "Feestzaal", "Andere"],
  huurderHernieuwingsrecht: ["Ja - eerste hernieuwing (van drie)", "Ja - tweede hernieuwing (van drie)", "Ja - derde/laatste hernieuwing", "Nee / onbekend"],
  // interne afwerking bij KMO-vastgoed/Bedrijfsvastgoed (zie StepBedrijfskenmerken) — bewust een
  // eigen, niet-residentiële lijst i.p.v. de woongerichte vloer-/muurafwerkingen elders in de app
  bedrijfsVloerafwerking: ["Gepolierde/geschuurde industriële betonvloer", "Epoxycoating", "Tegels", "Tapijttegels (kantoor)", "Laminaat/PVC (kantoor)", "Anti-slipvloer (horeca/sanitair)", "Verhoogde vloer (kantoor, bekabeling)", "Onafgewerkt/ruwbouw", "Andere"],
  pandType: ["Woning", "Appartement", "Handelspand", "Opbrengsteigendom"],
  // aparte, niet-residentiële "Pand"-lijst voor KMO-vastgoed/Bedrijfsvastgoed (zie StepType) —
  // zo verschijnt "Woning"/"Appartement" nooit meer als keuze bij een bedrijfsmatig dossier.
  // "Bedrijfswoning" is bewust wél opgenomen: een woonst gekoppeld aan een bedrijf/hoeve/KMO
  // (bv. conciërgewoning bij een magazijn) is een courant en relevant onderscheid, geen residentieel
  // pandtype op zich.
  pandTypeBedrijfsmatig: ["Bedrijfsgebouw", "Bedrijfsloods/magazijn", "KMO-unit", "Kantoorgebouw", "Winkelpand", "Horecapand", "Gemengd (kantoor/magazijn)", "Bedrijfswoning (gecombineerd)", "Andere"],
  bouwtype: ["Open", "Halfopen", "Gesloten"],
  orientatie: ["Noord", "Noordoost", "Oost", "Zuidoost", "Zuid", "Zuidwest", "West", "Noordwest"],
  staat: ["Af te werken", "Casco (in te richten)", "Gedeeltelijk gerenoveerd", "Gerenoveerd", "Instapklaar", "Nieuw", "Op te frissen", "Te renoveren", "Te slopen"],
  ruwbouw: ["Traditioneel metselwerk", "Gelijmd metselwerk", "Prefabconstructie", "Houtskeletbouw", "Houtmassiefbouw", "Staalconstructie", "Andere"],
  // veelvoorkomende gevelafwerkingen — snelkeuze bij Voorgevel/Zijgevel/Achtergevel, zodat niet
  // steeds dezelfde omschrijving 3x manueel getypt moet worden (blijft gewoon vrije tekst)
  gevelmateriaal: ["Gevelsteen (baksteen)", "Sierpleister / crepi", "Gepleisterd", "Betonpanelen", "Natuursteen", "Houten gevelbekleding", "Vezelcementplaten", "Kunststof gevelbekleding"],
  // snelkeuze voor "Constructie & materiaal bijgebouw" (blijft ook vrije tekst)
  bijgebouwConstructieType: ["Metselwerk", "Beton", "Hout", "Metaal", "Prefab", "Glas"],
  hoofddakType: ["Zadeldak", "Plat dak", "Schilddak", "Mansarde", "Puntdak", "Wolfsdak", "Torendak", "Vlinderdak", "Sheddak", "Koepel", "Frans", "Gemengd", "Strodak"],
  hoofddakMateriaal: ["Pannen", "Leien", "Roofing", "EPDM", "Zink", "Koper", "Natuursteen", "Riet", "Glas", "Grindbedekking"],
  epcStatus: ["Aanwezig", "Niet aanwezig", "Aangevraagd"],
  isolatie: ["Dakisolatie", "Gevelisolatie", "Muurisolatie", "Spouwisolatie", "Spouwmuur", "Vloerplaat", "Niet bepaald"],
  buitenschrijnwerk: ["3-dubbele beglazing", "Dubbele beglazing (HR)", "Enkele beglazing", "Superisolerend HR-glas", "Veiligheidsglas", "Aluminium", "Hout", "Metaal", "PVC", "Staal", "Luiken - handmatig", "Luiken - elektrisch"],
  verwarmingSoort: ["Centrale verwarming", "Gemeenschappelijke verwarming", "Individuele verwarming", "Geen verwarming"],
  verwarmingGrondstof: ["Elektriciteit", "Gas", "Hout", "Kolen", "Pellets", "Stookolie", "Warmtepomp", "Zonnepanelen"],
  verwarmingElementen: ["Accumulatie", "Condensatieketel", "Hoogrendementsketel", "Convectoren", "(Gas)kachels", "Plafondverwarming", "Radiatoren", "Vloerverwarming", "Warme lucht", "Calorimeters", "Digitaal"],
  warmWater: ["Boiler elektrisch", "Boiler gas", "Boiler op CV", "Doorstroomsysteem op CV", "Geiser op CV", "Gasgeiser", "Hoogrendementsketel", "Warmtepomp", "Andere"],
  keuringStatus: ["Keuring aanwezig - conform", "Keuring aanwezig - niet conform", "Keuring niet aanwezig"],
  allerlei: ["Airco", "Alarm", "Parlofoon", "Rolluiken", "Luiken", "Screens", "Veiligheidsdeur", "Vliegenramen", "Vloerverwarming", "Zonwering", "Zonnepanelen", "Thuisbatterij", "Laadpaal"],
  hall: ["Alarm", "Authentieke elementen", "Gastentoilet", "Parlofoon", "Veiligheidsdeur", "Videofoon"],
  woonkamer: ["Inbouwcassette", "Open haard", "Alle comfort", "Eenvoudig", "Goed onderhouden", "Ingericht", "In te richten", "L-vorm", "Moderne afwerking", "Rustieke afwerking"],
  keuken: [
    "Alleen leidingen", "Bar-tablet", "Combi-oven", "Dampkap", "Diepvries", "Enkel kasten",
    "Koelkast", "Koelkast met vriesvak", "Koffieautomaat",
    "Kookplaat - elektrisch", "Kookplaat - gas", "Kookplaat - halogeen", "Kookplaat - inductie", "Kookplaat - keramisch",
    "Microgolfoven", "Oven - elektrisch", "Oven - gas", "Oven - stoom", "Oven - hete lucht",
    "Spoelbak enkel", "Spoelbak dubbel", "Vaatwasmachine", "Volledig ingebouwd", "Wijnklimaatkast",
    "Spatwand - geen", "Spatwand - tegels", "Spatwand - glas", "Spatwand - inox",
    "Alle comfort", "Eenvoudig", "Goed onderhouden", "Ingericht", "In te richten",
    "Luxueuze afwerking", "Moderne afwerking", "Muren betegeld", "Open keuken", "Rustieke afwerking",
  ],
  badkamer: [
    "Aansluiting droogkast", "Aansluiting wasmachine", "Alleen leidingen", "Bidet", "Douche",
    "Hydrobad", "Inloopdouche", "Jacuzzi", "Ligbad", "Thermostatische kraan", "Toilet", "Voetbad",
    "Wastafel enkel", "Wastafel dubbel", "Wastafel in meubel enkel", "Wastafel in meubel dubbel",
    "Regendouche", "Sauna", "Wellness bad", "Zitbad",
    "Alle comfort", "Eenvoudig", "Goed onderhouden", "Muren betegeld",
  ],
  berging: ["Aansluiting droogkast", "Aansluiting wasmachine"],
  kelder: ["Aansluiting droogkast", "Aansluiting wasmachine", "Individuele private kelder", "Inpandige garage", "Deels kruipkelder", "Deels onderkelderd", "Volledige kruipkelder", "Volledig onderkelderd"],
  // "wat het is": aparte, expliciete typering (los van de inrichting hieronder) — een pand kan
  // meerdere van deze tegelijk hebben (bv. zowel een garage als een oprit)
  garageType: ["Garage", "Box", "Carport", "Oprit", "Staanplaats"],
  // "hoe het is ingericht" — apart uitgesplitst in exterieur (poort/toegang, buitenkant) en
  // interieur (technieken, isolatie, berging binnenin) voor een duidelijke, leesbare rapportering
  garageExterieur: [
    "Automatische garagepoort", "Sectionele poort", "Kantelpoort", "Rolpoort", "Draaideuren", "Manuele poort",
    "Oprit verhard", "Oprit halfverhard", "Afsluitbare toegang/poort oprit",
  ],
  garageInterieur: [
    "Elektriciteitsaansluiting", "Verlichting", "Waterpunt", "Oplaadpunt elektrische wagen",
    "Aansluiting droogkast", "Aansluiting wasmachine",
    "Geïsoleerd", "Verwarmd",
    "Bijkomende berging/opslagruimte", "Fietsenberging",
  ],
  tuinTerras: ["Buitenkeuken", "Jacuzzi", "Moestuin", "Tuinhuis", "Vijver", "Zandbak", "Zwembad"],
  aanbod: ["Nihil", "Sporadisch", "Normaal", "Ruim"],
  kwaliteit: ["Zeer goed", "Goed", "Matig", "Slecht"],
  gewestplan: ["Woongebied", "Woonuitbreidingsgebied", "Agrarisch gebied", "Industriegebied", "Andere"],
  jaNee: ["Ja", "Nee", "Onbekend"],
  score: ["A", "B", "C", "D"],
  klasse: KLASSEN.map((k) => k.label),
  recht: ["Volle eigendom", "Vruchtgebruik", "Naakte eigendom", "Erfpacht", "Opstalrecht", "Andere"],
  hoogteligging: ["Gelijk met straatniveau", "Verhoogd t.o.v. straat", "Verlaagd t.o.v. straat"],
  wijzeVanWaardering: ["Vergelijkende methode", "Analytische methode", "Redelijke methode"],
  aardTransactie: ["Verkoop uit de hand", "Vrijwillige openbare verkoop", "Gedwongen openbare verkoop", "Gerechtelijke verkoop"],
  huurcontractType: ["Woninghuur 9 jaar", "Woninghuur korte duur", "Handelshuur", "Andere"],
  // niet-residentiële contractlijst (zie StepMarkt) — vermijdt "Woninghuur" als keuze bij een
  // verhuurd KMO-/bedrijfspand.
  huurcontractTypeBedrijfsmatig: ["Handelshuur (9 jaar, wet 30/04/1951)", "Handelshuur (korte duur/pop-up)", "Kantoor-/bedrijfsruimtehuur (gemeen recht)", "Andere"],
  fotoCategorie: ["Voorgevel", "Zijgevel", "Achtergevel", "Tuin", "Interieur", "Liggingsplan", "Situeringsplan", "Schets indeling", "Andere"],
  omgevingsvoorzieningen: ["Winkels/handelszaken", "Scholen", "Kinderdagverblijf", "Bank/postkantoor", "Apotheek", "Ziekenhuis", "Bejaardentehuis", "Administratie/gemeentehuis", "Horeca", "Groene ruimte/park", "Sportfaciliteiten"],
  bereikbaarheid: ["Vlot bereikbaar met de wagen", "Nabij openbaar vervoer (bus)", "Nabij openbaar vervoer (trein)", "Nabij op-/afrit autosnelweg", "Fietsvriendelijke omgeving", "Beperkte parkeermogelijkheden", "Rustige, verkeersluwe straat"],
  // "de toestand en uitrusting van de straat, de openbare nutsvoorzieningen" — Vlabel-kwaliteitseis 2.2.a
  straatuitrusting: ["Voetpad", "Straatverlichting", "Verharde weg", "Riolering", "Waterleiding", "Elektriciteit", "Aardgas", "Fietspad"],
};

const RUIMTE_CHECKLISTS = [
  { key: "hall", label: "Hall", icon: Sofa, opts: OPTS.hall },
  { key: "woonkamer", label: "Woonkamer", icon: Sofa, opts: OPTS.woonkamer },
  { key: "keuken", label: "Keuken", icon: Sofa, opts: OPTS.keuken, extraText: { key: "merken", placeholder: "Merken van de toestellen (bv. Bosch, Miele, AEG)..." } },
  { key: "badkamer", label: "Badkamer", icon: Sofa, opts: OPTS.badkamer },
  { key: "berging", label: "Berging", icon: Sofa, opts: OPTS.berging, extraText: { key: "andere", placeholder: "Andere..." } },
  { key: "kelder", label: "Kelder", icon: Sofa, opts: OPTS.kelder, extraText: { key: "andere", placeholder: "Andere..." } },
  { key: "garage", label: "Garage / box / carport / oprit / staanplaats", icon: Sofa,
    optGroups: [
      { key: "exterieur", label: "Exterieur (poort/toegang)", opts: OPTS.garageExterieur },
      { key: "interieur", label: "Interieur (technieken, isolatie, berging)", opts: OPTS.garageInterieur },
    ],
    extraNumber: { key: "aantal", label: "Aantal" }, extraMultiCheck: { key: "type", label: "Type (wat is het expliciet?)", opts: OPTS.garageType } },
  { key: "tuinTerras", label: "Tuin / terras", icon: Trees, opts: OPTS.tuinTerras, extraSelect: { key: "orientatie", label: "Oriëntatie", opts: OPTS.orientatie } },
];

const emptyRoomState = () => Object.fromEntries(RUIMTE_CHECKLISTS.map((r) => [
  r.key, { vloer: "", items: [], andere: "", merken: "", aantal: "", orientatie: "", type: [] },
]));

const initialData = {
  // dossierbeheer
  id: "", ownerId: "", status: "concept", aangemaaktOp: "", laatstBewerkt: "",

  // 1. identificatie schatter-expert (Vlabel-vereiste) — bij een nieuw dossier automatisch
  // ingevuld vanuit "Mijn account" (zie handleNew() in AppRoot)
  schatterNaam: "Thijs Houpels", schatterTitel: "Vastgoedmakelaar - Vlabel-erkend schatter", schatterVlabelNummer: "", schatterBivNummer: "",
  schatterTelefoon: "",
  // getekende handtekening bij de eedformule (base64 PNG, getekend via SignaturePad) — vervangt
  // de voordien louter getypte naam als ondertekening onderaan het verslag
  handtekening: "",

  // 1. contactgegevens verkoper + opdracht
  opdrachtgeverNaam: "", opdrachtgeverAdres: "", opdrachtgeverIdNummer: "", opdrachtgeverVertegenwoordiger: "",
  reden: "Nalatenschap",
  // "zelfde als"-vlaggen: zo moet je naam/adres niet meermaals intypen als opdrachtgever, verkoper
  // en/of eigenaar dezelfde persoon zijn, of het pandadres ook het adres van opdrachtgever/verkoper is
  opdrachtgeverIsEigenaar: false, opdrachtgeverAdresZelfde: false, verkoperAdresZelfde: false,
  verkoperNaam: "", verkoperAdres: "", verkoperTelefoon: "", verkoperEmail: "",
  datumBezoek: "", datumVerslag: "", opdrachtgeverAanwezig: "Ja",
  referentiedatum: "",
  // enkel relevant/getoond bij reden === "Nalatenschap" (Vlabel-schatting) — zie StepOpdracht
  overledenNaam: "", overledenRijksregisternummer: "", vlabelDossiernummer: "",
  straat: "", nummer: "", bus: "", postcode: "", gemeente: "", dorpGehucht: "", crabGegevens: "", capakey: "",
  // vooraf opgeloste CadGIS-kaartbbox + perceelsgeometrie (zie fetchCadgisPerceel hierboven) + de
  // capakey waarvoor die laatst werd opgezocht (om te weten wanneer capakey wijzigde en een
  // nieuwe opzoeking nodig is)
  cadgisBbox: "", cadgisRingen: [], cadgisCapakeyOpgezocht: "",
  // optionele voorpagina-foto (Street View-opname of eigen foto ter plaatse) — apart van de
  // bijlage-foto's hieronder, enkel gebruikt op de cover-pagina van het verslag
  voorpaginaFoto: null,

  // 2. type onroerend goed
  // vastgoedType stuurt welke wizardtabbladen en waarderingsvelden getoond worden — zie de
  // toelichting bovenaan StepType. "KMO-vastgoed" en "Bedrijfsvastgoed" delen dezelfde generieke
  // bedrijfsvelden hieronder; bij "Bedrijfsvastgoed" komt daar nog een subtype-specifieke sectie bij.
  vastgoedType: "Residentieel", bedrijfsSubtype: "",
  pandType: "Woning", aardWoning: "", bouwtype: "Gesloten", verdiepingen: "", lift: "Nee",
  bouwjaar: "", renovatiejaar: "", jaarVanAankoop: "", staat: [],

  // 2b. bedrijfskenmerken — enkel relevant/getoond bij vastgoedType "KMO-vastgoed" of
  // "Bedrijfsvastgoed" (zie StepBedrijfskenmerken). Bewust geen woningsgebonden ABEX-klasse: de
  // vervangingswaarde wordt hier manueel door de schatter-expert ingeschat (zie berekenWaardering),
  // net zoals de niet-residentiële EPC-regeling bewust als een keuzeveld i.p.v. een automatisch
  // toegepaste drempel wordt aangeboden (de exacte oppervlaktedrempels/data verschillen per bron).
  bedrijfsVervangingswaarde: "",
  bedrijfsEpcType: "", bedrijfsEpcWaarde: "", bedrijfsEpcCertificaatnummer: "",
  bedrijfsBestemmingszone: "", bedrijfsVergunningMilieu: "",
  bedrijfsParkeerplaatsen: "", bedrijfsLaadkades: "", bedrijfsOmschrijvingIndeling: "",
  bedrijfsVloerafwerking: "", bedrijfsPlafondafwerking: "", bedrijfsWandafwerking: "",
  // subtype "Kantoor"
  kantoorIndeling: "", kantoorVerdiepingen: "", kantoorLiftAanwezig: "Onbekend", kantoorServerruimte: "Onbekend", kantoorCertificering: "",
  // subtype "Winkel"
  winkelLocatiecategorie: "", winkelGevelbreedte: "", winkelEtalage: "Onbekend", winkelPasanten: "", winkelMagazijnAchteraan: "Onbekend",
  // subtype "Industrieel/logistiek"
  industrieelVrijeHoogte: "", industrieelVloerbelasting: "", industrieelAantalDockLevellers: "",
  industrieelElektrischVermogen: "", industrieelDeelbaarheid: "",
  // subtype "Horeca"
  horecaType: "", horecaVergunningUitbating: "Onbekend", horecaTerras: "Onbekend", horecaKeukenuitrusting: "", horecaZitplaatsen: "",

  // 3. kadastrale gegevens
  kadAfdeling: "", kadSectie: "", kadPerceelnummer: "", kadPartitienummer: "",
  kadastraleOpp: "", kadDetailPrivatief: "",
  ki: "", onroerendeVoorheffing: "",

  // 3b. eigendomstoestand / zakelijke rechten
  eigenaars: [{ id: 1, naam: "", recht: "Volle eigendom", aandeel: "" }],
  aankoopAkteType: "", aankoopAkteDatum: "", basisAkteDatum: "", erfdienstbaarheden: "", zakelijkeRechten: "",

  // 4. algemene beschrijving — ligging & omgeving
  omgevingsvoorzieningen: "", bereikbaarheid: "", straatuitrusting: "",
  vormPerceel: "", rooilijnbreedte: "", hoogteligging: "Gelijk met straatniveau",
  bodemoccupatie: "", aantalBijgebouwen: "", inplanting: "", bpaRupVerkaveling: "",

  // 5-6. constructie ruwbouw & dak
  ruwbouw: "Traditioneel metselwerk", ruwbouwAndere: "",
  hoofddakType: "Zadeldak", hoofddakMateriaal: "Pannen", bijgebouwConstructie: "",
  voorgevel: "", zijgevel: "", achtergevel: "", materiaalkwaliteitOmschrijving: "",

  // 7. isolatie
  epcStatus: "Aanwezig", epcWaarde: "", epcCertificaatnummer: "", isolatie: [],

  // 8. buitenschrijnwerk
  buitenschrijnwerk: [],

  // 9-10. verwarming & warm water
  verwarmingSoort: [], verwarmingGrondstof: [], verwarmingElementen: [], ketelMerkType: "",
  warmWater: [], warmWaterAndere: "", warmWaterKetelMerkType: "",

  // 11. technische installaties
  keuringStatus: "Keuring aanwezig - conform", dagNachtTeller: "Nee", allerlei: [],

  // 12. eigenschappen per ruimte
  eigenschappen: emptyRoomState(),
  slaapkamers: [{ id: 1, naam: "Slaapkamer 1", vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "Nee" }],
  extraRuimtes: [],

  // 13. verbouwingen
  verbouwingen: "",

  // 14. huurder
  huurderNaam: "", huurderTelefoon: "", huurderEmail: "", huurderHuurprijs: "",
  huurderContractType: "Woninghuur 9 jaar", huurderDuurtijd: "",
  // uitbreiding voor KMO-vastgoed/Bedrijfsvastgoed — kernbegrippen uit de Handelshuurwet (wet van
  // 30 april 1951): worden enkel getoond bij een niet-residentieel, verhuurd pand (zie StepMarkt);
  // Residentieel/Woninghuur blijft ongewijzigd bij de zes velden hierboven.
  huurderAanvangsdatum: "", huurderEersteOpzegmogelijkheid: "", huurderHernieuwingsrecht: "Onbekend",
  huurderIndexatie: "", huurderWaarborg: "", huurderOpzegtermijnBijzonderheden: "",

  // 15. afmetingen
  grondopp: "", breedtePerceel: "", breedteGevel: "", orientatie: "Zuid",
  bebouwdeOpp: "", bewoonbareOppSchatting: "",
  // bij een appartement: het aandeel in de gemeenschappelijke (binnen)delen van het gebouw
  // (traphal, gangen, technische lokalen, ...) dat mee in de nuttige/te taxeren oppervlakte
  // van deze kavel moet meetellen, in m² (los van de individuele ruimtes van de kavel zelf)
  gemeenschappelijkeDelenOpp: "",
  // bij een appartement: het aandeel van deze kavel in de mede-eigendom, uitgedrukt in 1000sten
  // (quotiteit) — dient om het effectief grondaandeel (in m²) van de totale grond van de
  // residentie/het complex te berekenen: grondopp (= totale grondoppervlakte van het complex,
  // hierboven) × aandeelDuizendsten / 1000
  aandeelDuizendsten: "",

  // gebouw (algemeen, blijft nodig voor waardering/rapport)
  bewoonbaarheid: "Zeer goed", gebruik: "Normaal", klasse: "Gewoon huis", gevel: "2-gevel",
  afwerkingBuiten: "Aangelegd",

  // markt & stedenbouw
  aanbodTeKoop: "Sporadisch", aanbodTeHuur: "Nihil",
  verkoopbaarheid: "Goed", uitzicht: "Goed", onderhoud: "Goed", inrichting: "Goed",
  gewestplan: "Woongebied", erfgoed: "Nee", voorkooprecht: "Nee",
  watertoetsP: "A", watertoetsG: "A", bouwmisdrijven: "Nee", vergunning: "Ja",
  verkaveling: "Ja", mobiscore: "",

  // swot
  sterktes: "", zwaktes: "", kansen: "", bedreigingen: "", conclusie: "", notities: "",

  // bijlagen
  fotos: [], documenten: [],

  // wijze van waardering & vergelijkingspunten
  wijzeVanWaardering: "Vergelijkende methode", wijzeVanWaarderingMotivering: "",
  vergelijkingspunten: [],

  // parkeerplaatsen & garages die apart (los van het/de hoofdpand(en)) gewaardeerd worden — bv.
  // een reeks ondergrondse autostaanplaatsen met een eigen kadastraal perceel bij een
  // appartementsgebouw. Blijft dossierbreed (niet per pand hieronder): dit soort kavels hoort
  // meestal bij de hele opdracht, niet bij één specifiek pand. Zie berekenParkeerplaatsenTotaal().
  parkeerplaatsenGarages: [],

  // bijkomende panden binnen ditzelfde dossier/verslag — voor een opdracht die meerdere,
  // eventueel qua vastgoedType verschillende eigendommen omvat (bv. een nalatenschap met een
  // woning én een handelspand) maar in één schattingsverslag moet resulteren. Het hoofdpand
  // blijft, zoals voorheen, gewoon de vlakke velden hierboven (volledig achterwaarts compatibel
  // met elk bestaand dossier); elk item hier is een volwaardige, zelfstandige "pand-snede" met
  // exact dezelfde velden als een pand vandaag heeft (zie maakLeegPand()) — enkel de
  // opdrachtgegevens, eigenaars en de voorpaginafoto blijven eenmalig, dossierbreed.
  extraPanden: [],

  // eedformule / ondertekening
  eedPlaats: "Beveren",

  // 16. indeling / oppervlaktes (rekenmodule)
  ruimtes: [{ id: 1, verdieping: "gelijkvloers", naam: "Leefruimte", opp: "", coeff: 1, vloer: "" }],
  schijven: [
    { id: 1, naam: "Eerste 50 meter", opp: "", prijs: "" },
    { id: 2, naam: "Van 50 tot 75 meter", opp: "", prijs: "" },
    { id: 3, naam: "Van 75 tot 100 meter", opp: "", prijs: "" },
  ],

  // waardering
  abexIndexHuidig: 1071,
  vetOuderdom: 15, vetFrequentie: 20, vetGebruik: 20, vetKwaliteit: 20,
  huurMaand: "", yieldVan: 3.5, yieldTot: 4.5, yieldStap: 0.5,
  gedwongenFactor: 0.88, venaleWaarde: "", marktMargeOnderPct: 5, marktMargeBovenPct: 5,

  // waardering — optionele extra's (staan standaard UIT; de schatter-expert kiest zelf of, en hoe,
  // deze meetellen — zie StepWaardering). Geen enkele hiervan is verplicht voor een geldige taxatie.
  energiecorrectieActief: false, energiecorrectiePct: "", energiecorrectieMotivering: "",
  dcfMeerjarenActief: false, dcfJaren: 10, dcfHuurgroeiPct: 2, dcfLeegstandPct: 0,
  dcfDiscontovoetPct: 6, dcfExitYieldPct: "", dcfMotivering: "",
  residueelActief: false, residueelEindwaarde: "", residueelBouwkost: "",
  residueelBijkomendeKostenPct: 12, residueelWinstmargePct: 15, residueelMotivering: "",
};

// Eén "pand-snede": exact dezelfde per-pand-velden als hierboven op initialData staan (adres,
// type/staat/kadaster, constructie, ruimtes/bedrijfskenmerken, markt/huurder, swot, afmetingen,
// vergelijkingspunten, foto's/documenten, waardering) — bewust ZONDER de dossierbrede velden
// (opdrachtgever, schatter-expert, eigenaars, voorpaginafoto, parkeerplaatsen/garages, ...), die
// hoe dan ook maar één keer per dossier bestaan. Gebruikt voor elk item in d.extraPanden — het
// hoofdpand zelf blijft ongewijzigd de vlakke velden van initialData (zie DossierWizard/bindPand).
function maakLeegPand(naam = "") {
  return {
    pandId: uid(), pandNaam: naam,
    straat: "", nummer: "", bus: "", postcode: "", gemeente: "", dorpGehucht: "", crabGegevens: "", capakey: "",
    cadgisBbox: "", cadgisRingen: [], cadgisCapakeyOpgezocht: "",

    vastgoedType: "Residentieel", bedrijfsSubtype: "",
    pandType: "Woning", aardWoning: "", bouwtype: "Gesloten", verdiepingen: "", lift: "Nee",
    bouwjaar: "", renovatiejaar: "", jaarVanAankoop: "", staat: [],

    bedrijfsVervangingswaarde: "",
    bedrijfsEpcType: "", bedrijfsEpcWaarde: "", bedrijfsEpcCertificaatnummer: "",
    bedrijfsBestemmingszone: "", bedrijfsVergunningMilieu: "",
    bedrijfsParkeerplaatsen: "", bedrijfsLaadkades: "", bedrijfsOmschrijvingIndeling: "",
    bedrijfsVloerafwerking: "", bedrijfsPlafondafwerking: "", bedrijfsWandafwerking: "",
    kantoorIndeling: "", kantoorVerdiepingen: "", kantoorLiftAanwezig: "Onbekend", kantoorServerruimte: "Onbekend", kantoorCertificering: "",
    winkelLocatiecategorie: "", winkelGevelbreedte: "", winkelEtalage: "Onbekend", winkelPasanten: "", winkelMagazijnAchteraan: "Onbekend",
    industrieelVrijeHoogte: "", industrieelVloerbelasting: "", industrieelAantalDockLevellers: "",
    industrieelElektrischVermogen: "", industrieelDeelbaarheid: "",
    horecaType: "", horecaVergunningUitbating: "Onbekend", horecaTerras: "Onbekend", horecaKeukenuitrusting: "", horecaZitplaatsen: "",

    kadAfdeling: "", kadSectie: "", kadPerceelnummer: "", kadPartitienummer: "",
    kadastraleOpp: "", kadDetailPrivatief: "",
    ki: "", onroerendeVoorheffing: "",

    omgevingsvoorzieningen: "", bereikbaarheid: "", straatuitrusting: "",
    vormPerceel: "", rooilijnbreedte: "", hoogteligging: "Gelijk met straatniveau",
    bodemoccupatie: "", aantalBijgebouwen: "", inplanting: "", bpaRupVerkaveling: "",

    ruwbouw: "Traditioneel metselwerk", ruwbouwAndere: "",
    hoofddakType: "Zadeldak", hoofddakMateriaal: "Pannen", bijgebouwConstructie: "",
    voorgevel: "", zijgevel: "", achtergevel: "", materiaalkwaliteitOmschrijving: "",

    epcStatus: "Aanwezig", epcWaarde: "", epcCertificaatnummer: "", isolatie: [],
    buitenschrijnwerk: [],

    verwarmingSoort: [], verwarmingGrondstof: [], verwarmingElementen: [], ketelMerkType: "",
    warmWater: [], warmWaterAndere: "", warmWaterKetelMerkType: "",

    keuringStatus: "Keuring aanwezig - conform", dagNachtTeller: "Nee", allerlei: [],

    eigenschappen: emptyRoomState(),
    slaapkamers: [{ id: 1, naam: "Slaapkamer 1", vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "Nee" }],
    extraRuimtes: [],

    verbouwingen: "",

    huurderNaam: "", huurderTelefoon: "", huurderEmail: "", huurderHuurprijs: "",
    huurderContractType: "Woninghuur 9 jaar", huurderDuurtijd: "",
    huurderAanvangsdatum: "", huurderEersteOpzegmogelijkheid: "", huurderHernieuwingsrecht: "Onbekend",
    huurderIndexatie: "", huurderWaarborg: "", huurderOpzegtermijnBijzonderheden: "",

    grondopp: "", breedtePerceel: "", breedteGevel: "", orientatie: "Zuid",
    bebouwdeOpp: "", bewoonbareOppSchatting: "",
    gemeenschappelijkeDelenOpp: "", aandeelDuizendsten: "",

    bewoonbaarheid: "Zeer goed", gebruik: "Normaal", klasse: "Gewoon huis", gevel: "2-gevel",
    afwerkingBuiten: "Aangelegd",

    aanbodTeKoop: "Sporadisch", aanbodTeHuur: "Nihil",
    verkoopbaarheid: "Goed", uitzicht: "Goed", onderhoud: "Goed", inrichting: "Goed",
    gewestplan: "Woongebied", erfgoed: "Nee", voorkooprecht: "Nee",
    watertoetsP: "A", watertoetsG: "A", bouwmisdrijven: "Nee", vergunning: "Ja",
    verkaveling: "Ja", mobiscore: "",

    sterktes: "", zwaktes: "", kansen: "", bedreigingen: "", conclusie: "", notities: "",

    fotos: [], documenten: [],

    wijzeVanWaardering: "Vergelijkende methode", wijzeVanWaarderingMotivering: "",
    vergelijkingspunten: [],

    ruimtes: [{ id: 1, verdieping: "gelijkvloers", naam: "Leefruimte", opp: "", coeff: 1, vloer: "" }],
    schijven: [
      { id: 1, naam: "Eerste 50 meter", opp: "", prijs: "" },
      { id: 2, naam: "Van 50 tot 75 meter", opp: "", prijs: "" },
      { id: 3, naam: "Van 75 tot 100 meter", opp: "", prijs: "" },
    ],

    abexIndexHuidig: 1071,
    vetOuderdom: 15, vetFrequentie: 20, vetGebruik: 20, vetKwaliteit: 20,
    huurMaand: "", yieldVan: 3.5, yieldTot: 4.5, yieldStap: 0.5,
    gedwongenFactor: 0.88, venaleWaarde: "", marktMargeOnderPct: 5, marktMargeBovenPct: 5,

    energiecorrectieActief: false, energiecorrectiePct: "", energiecorrectieMotivering: "",
    dcfMeerjarenActief: false, dcfJaren: 10, dcfHuurgroeiPct: 2, dcfLeegstandPct: 0,
    dcfDiscontovoetPct: 6, dcfExitYieldPct: "", dcfMotivering: "",
    residueelActief: false, residueelEindwaarde: "", residueelBouwkost: "",
    residueelBijkomendeKostenPct: 12, residueelWinstmargePct: 15, residueelMotivering: "",
  };
}



export {
  INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER,
  HUYZEN_BLAUW, HUYZEN_LOGO_B64, HUISSTIJLEN, kiesHuisstijl, HuisstijlContext,
  KLASSEN, ABEX_INDEX_1998, GEVEL_FACTOR, VERDIEPINGEN, OPTS, RUIMTE_CHECKLISTS,
  emptyRoomState, initialData, maakLeegPand,
};
