-- Correct the initials used by Deng Chenyan's profile ID. All profile foreign
-- keys use ON UPDATE CASCADE, so dependent leader and task references follow.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "profiles" WHERE "id" = 'user-djy')
       AND EXISTS (SELECT 1 FROM "profiles" WHERE "id" = 'user-dcy') THEN
        RAISE EXCEPTION 'Cannot rename user-djy: user-dcy already exists';
    END IF;

    UPDATE "profiles"
    SET "id" = 'user-dcy'
    WHERE "id" = 'user-djy';
END $$;
