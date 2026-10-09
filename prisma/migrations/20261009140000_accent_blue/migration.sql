-- Nouvelle charte (bleu) : les foyers restés sur l'ancienne couleur par défaut (vert) passent au bleu
UPDATE "Household" SET "accentColor" = '#133c8b' WHERE "accentColor" IN ('#15803d', '#16a34a');
